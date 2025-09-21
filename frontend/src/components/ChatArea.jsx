import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  Flex,
  Icon,
  Avatar,
  InputGroup,
  InputRightElement,
  useToast,
} from "@chakra-ui/react";
import { FiSend, FiInfo, FiMessageCircle } from "react-icons/fi";
import UsersList from "./UsersList";
import { useRef, useState, useEffect } from "react";
import axios from "axios";
import apiURL from "../../utils";

const ChatArea = ({ selectedGroup, socket, setSelectedGroup }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const toast = useToast();

  const currentUser = JSON.parse(localStorage.getItem("userInfo") || "{}");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (selectedGroup && socket) {
      fetchMessages();
      socket.emit("join room", selectedGroup._id);

      // Listen for the corrected 'message received' event
      socket.on("message received", (newMessage) => {
        // Only update state if the message belongs to the selected group
        if (newMessage.group === selectedGroup._id) {
          setMessages((prev) => [...prev, newMessage]);
        }
      });

      socket.on("users in room", (users) => {
        setConnectedUsers(users);
      });

      socket.on("user joined", (user) => {
        setConnectedUsers((prev) => [...prev, user]);
      });

      socket.on("user left", (userId) => {
        setConnectedUsers((prev) =>
          prev.filter((user) => user?._id !== userId)
        );
      });

      socket.on("notification", (notification) => {
        toast({
          title:
            notification?.type === "USER_JOINED" ? "New User" : "Notification",
          description: notification.message,
          status: "info",
          duration: 3000,
          isClosable: true,
          position: "top-right",
        });
      });

      socket.on("user typing", ({ username }) => {
        setTypingUsers((prev) => new Set(prev).add(username));
      });

      socket.on("user stop typing", ({ username }) => {
        setTypingUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(username);
          return newSet;
        });
      });

      // Cleanup listeners on component unmount or group change
      return () => {
        socket.emit("leave room", selectedGroup._id);
        socket.off("message received");
        socket.off("users in room");
        socket.off("user joined");
        socket.off("user left");
        socket.off("notification");
        socket.off("user typing");
        socket.off("user stop typing");
      };
    }
  }, [selectedGroup, socket, toast]);

  const fetchMessages = async () => {
    if (!selectedGroup) return;
    const token = currentUser?.token;
    try {
      const { data } = await axios.get(
        `${apiURL}/api/messages/${selectedGroup._id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setMessages(data);
    } catch (error) {
      console.log(error);
      toast({
        title: "Error fetching messages",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) {
      return;
    }
    try {
      const token = currentUser.token;
      const { data } = await axios.post(
        `${apiURL}/api/messages`,
        {
          content: newMessage,
          groupId: selectedGroup?._id,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      // Emit the message to the server, which will broadcast it back to everyone
      socket.emit("new message", {
        ...data,
        group: selectedGroup?._id,
      });

      // DO NOT set messages here to prevent duplication
      setNewMessage("");
    } catch (error) {
      toast({
        title: "Error sending message",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (!isTyping && selectedGroup) {
      setIsTyping(true);
      socket.emit("typing", {
        groupId: selectedGroup._id,
        username: currentUser.username,
      });
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      if (selectedGroup) {
        socket.emit("stop typing", {
          groupId: selectedGroup._id,
          username: currentUser.username,
        });
      }
      setIsTyping(false);
    }, 2000);
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderTypingIndicator = () => {
    const otherTypingUsers = Array.from(typingUsers).filter(
      (username) => username !== currentUser.username
    );
    if (otherTypingUsers.length === 0) return null;
    const usersText =
      otherTypingUsers.length === 1
        ? `${otherTypingUsers[0]} is typing...`
        : `${otherTypingUsers.join(", ")} are typing...`;

    return (
      <Box alignSelf="flex-start" maxW="70%">
        <Flex align="center" p={2} borderRadius="lg" gap={2}>
          <Text fontSize="sm" color="gray.500" fontStyle="italic">
            {usersText}
          </Text>
        </Flex>
      </Box>
    );
  };

  return (
    <Flex
      h="100%"
      position="relative"
      direction={{ base: "column", lg: "row" }}
    >
      <Box
        flex="1"
        display="flex"
        flexDirection="column"
        bg="gray.50"
        maxW={{ base: "100%", lg: `calc(100% - 260px)` }}
      >
        {selectedGroup ? (
          <>
            <Flex
              px={6}
              py={4}
              bg="white"
              borderBottom="1px solid"
              borderColor="gray.200"
              align="center"
              boxShadow="sm"
            >
              <Button
                display={{ base: "inline-flex", md: "none" }}
                variant="ghost"
                mr={2}
                onClick={() => setSelectedGroup(null)}
              >
                ←
              </Button>
              <Icon
                as={FiMessageCircle}
                fontSize="24px"
                color="blue.500"
                mr={3}
              />
              <Box flex="1">
                <Text fontSize="lg" fontWeight="bold" color="gray.800">
                  {selectedGroup.name}
                </Text>
                <Text fontSize="sm" color="gray.500">
                  {selectedGroup.description}
                </Text>
              </Box>
              <Icon
                as={FiInfo}
                fontSize="20px"
                color="gray.400"
                cursor="pointer"
                _hover={{ color: "blue.500" }}
              />
            </Flex>

            <VStack
              flex="1"
              overflowY="auto"
              spacing={4}
              align="stretch"
              px={6}
              py={4}
              position="relative"
              sx={{
                "&::-webkit-scrollbar": { width: "8px" },
                "&::-webkit-scrollbar-track": { width: "10px" },
                "&::-webkit-scrollbar-thumb": {
                  background: "gray.200",
                  borderRadius: "24px",
                },
              }}
            >
              {messages.map((message, index) => (
                <Box
                  key={message._id || `msg-${index}`}
                  alignSelf={
                    message.sender._id === currentUser?._id
                      ? "flex-end"
                      : "flex-start"
                  }
                  maxW="70%"
                >
                  <Flex direction="column" gap={1}>
                    <Flex
                      align="center"
                      mb={1}
                      justifyContent={
                        message.sender._id === currentUser?._id
                          ? "flex-end"
                          : "flex-start"
                      }
                      gap={2}
                    >
                      {message.sender._id !== currentUser?._id && (
                        <Avatar size="xs" name={message.sender.username} />
                      )}
                      <Text fontSize="xs" color="gray.500">
                        {message.sender._id === currentUser?._id
                          ? "You"
                          : message.sender.username}{" "}
                        • {formatTime(message.createdAt)}
                      </Text>
                    </Flex>

                    <Box
                      bg={
                        message.sender._id === currentUser?._id
                          ? "blue.500"
                          : "white"
                      }
                      color={
                        message.sender._id === currentUser?._id
                          ? "white"
                          : "gray.800"
                      }
                      p={3}
                      borderRadius="lg"
                      boxShadow="sm"
                    >
                      <Text>{message.content}</Text>
                    </Box>
                  </Flex>
                </Box>
              ))}
              {renderTypingIndicator()}
              <div ref={messagesEndRef} />
            </VStack>

            <Box
              p={4}
              bg="white"
              borderTop="1px solid"
              borderColor="gray.200"
              position="relative"
              zIndex="1"
            >
              <InputGroup size="lg">
                <Input
                  value={newMessage}
                  onChange={handleTyping}
                  placeholder="Type your message..."
                  pr="4.5rem"
                  bg="gray.50"
                  border="none"
                  _focus={{ boxShadow: "none", bg: "gray.100" }}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      sendMessage();
                    }
                  }}
                />
                <InputRightElement width="4.5rem">
                  <Button
                    h="1.75rem"
                    size="sm"
                    colorScheme="blue"
                    borderRadius="full"
                    _hover={{ transform: "translateY(-1px)" }}
                    transition="all 0.2s"
                    onClick={sendMessage}
                  >
                    <Icon as={FiSend} />
                  </Button>
                </InputRightElement>
              </InputGroup>
            </Box>
          </>
        ) : (
          <Flex
            h="100%"
            direction="column"
            align="center"
            justify="center"
            p={8}
            textAlign="center"
          >
            <Icon
              as={FiMessageCircle}
              fontSize="64px"
              color="gray.300"
              mb={4}
            />
            <Text fontSize="xl" fontWeight="medium" color="gray.500" mb={2}>
              Welcome to the Chat
            </Text>
            <Text color="gray.500" mb={2}>
              Select a group from the sidebar to start chatting
            </Text>
          </Flex>
        )}
      </Box>

      <Box
        width={{ base: "100%", lg: "260px" }}
        position={{ base: "static", lg: "sticky" }}
        right={0}
        top={0}
        height={{ base: "auto", lg: "100%" }}
        flexShrink={0}
        display={{ base: "none", lg: "block" }}
      >
        {selectedGroup && <UsersList users={connectedUsers} />}
      </Box>
    </Flex>
  );
};

export default ChatArea;
