import  { useState, useEffect } from "react";
import io from "socket.io-client";
import axios from "axios";

const socket = io(process.env.REACT_APP_BACKEND_URL);

export default function GroupChatApp() {
  const [currentUser, setCurrentUser] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [userGroups, setUserGroups] = useState([]);

  useEffect(() => {
    const user = localStorage.getItem('username') || prompt("Enter your username:");
    setCurrentUser(user);
    localStorage.setItem('username', user);
    
    fetchUserGroups(user);
  }, []);

  const fetchUserGroups = async (username) => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/groups/user/${username}`);
      setUserGroups(res.data);
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  };

  const handleGroupCreated = (newGroup) => {
    setUserGroups([...userGroups, newGroup]);
    setSelectedGroup(newGroup);
  };

  return (
    <div style={{ display: "flex", height: "89vh" }}>
      <div style={{ width: "300px", borderRight: "1px solid #ccc", padding: "20px" }}>
        <h3>UserName: {currentUser}</h3>
        <CreateGroupChat 
          currentUser={currentUser} 
          onGroupCreated={handleGroupCreated}
        />
        
        <div style={{ marginTop: "20px" }}>
          <h3>Your Groups</h3>
          {userGroups.map((group) => (
            <div 
              key={group._id}
              style={{
                padding: "10px",
                margin: "5px 0",
                backgroundColor: selectedGroup?._id === group._id ? "#e3f2fd" : "#f5f5f5",
                cursor: "pointer",
                borderRadius: "5px"
              }}
              onClick={() => setSelectedGroup(group)}
            >
              <strong>{group.name}</strong>
              <div style={{ fontSize: "12px", color: "#666" }}>
                {group.members.length} members
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        {selectedGroup ? (
          <GroupChat 
            group={selectedGroup} 
            currentUser={currentUser}
          />
        ) : (
          <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center", 
            height: "100%",
            color: "#666"
          }}>
            Select a group to start chatting
          </div>
        )}
      </div>
    </div>
  );
}



function CreateGroupChat({ currentUser, onGroupCreated }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const searchUsers = async (q) => {
    setSearch(q);
    if (q.length > 1) {
      try {
        const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/users/search?q=${q}`);
        const filteredResults = res.data.filter(user => user.username !== currentUser);
        setResults(filteredResults);
      } catch (error) {
        console.error("Error searching users:", error);
        setResults([]);
      }
    } else {
      setResults([]);
    }
  };

  const toggleUser = (user) => {
    const exists = selectedUsers.find((u) => u._id === user._id);
      setSelectedUsers([...selectedUsers, user]);
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      alert("Please enter a group name");
      return;
    }
    
    if (selectedUsers.length < 1) {
      alert("Select at least one user to create a group");
      return;
    }

    setIsCreating(true);
    try {
      const members = [
        { username: currentUser },
        ...selectedUsers.map(user => ({ username: user.username, _id: user._id }))
      ];

      const groupData = {
        name: groupName,
        members: members,
        createdBy: currentUser
      };

      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/groups/create`, groupData);
      
      setGroupName("");
      setSelectedUsers([]);
      setSearch("");
      setResults([]);
      
      onGroupCreated(res.data);
      alert("Group created successfully!");
      
    } catch (error) {
      console.error("Error creating group:", error);
      alert("Error creating group. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div>
      <h3>Create New Group</h3>
      
      <input
        type="text"
        placeholder="Group name..."
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
      />
      
      <input
        type="text"
        placeholder="Search users..."
        value={search}
        onChange={(e) => searchUsers(e.target.value)}
        style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
      />
      
      <div style={{ maxHeight: "150px", overflowY: "auto" }}>
        {results.map((user) => (
          <div
            key={user._id}
            style={{
              cursor: "pointer",
              background: selectedUsers.find((u) => u._id === user._id) ? "#d3f8d3" : "#f1f1f1",
              padding: "8px",
              marginBottom: "2px",
              borderRadius: "3px"
            }}
            onClick={() => toggleUser(user)}
          >
            {user.username}
          </div>
        ))}
      </div>

      {selectedUsers.length > 0 && (
        <div style={{ marginTop: "10px" }}>
          <h5>Selected Users:</h5>
          <div>
            {selectedUsers.map((u) => (
              <span
                key={u._id}
                style={{
                  background: "#e3f2fd",
                  padding: "4px 8px",
                  margin: "2px",
                  borderRadius: "12px",
                  fontSize: "12px",
                  display: "inline-block"
                }}
              >
                {u.username}
               
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={createGroup}
        disabled={isCreating}
        style={{
          width: "100%",
          padding: "10px",
          marginTop: "10px",
          backgroundColor: "#3f689b",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: isCreating ? "not-allowed" : "pointer"
        }}
      >
        {isCreating ? "Creating..." : "Create Group"}
      </button>
    </div>
  );
}




function GroupChat({ group, currentUser }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isUserInGroup, setIsUserInGroup] = useState(false);

  useEffect(() => {
    const isMember = group.members.some(member => member.username === currentUser);
    setIsUserInGroup(isMember);

    if (isMember) {
      socket.emit("join_group_room", { name: currentUser, room: group._id });
      
      fetchMessages();
    }

    const handleReceiveMessage = (data) => {
      
      setMessages((prev) => [...prev, data]);
    };

    

    socket.on("receive_group_message", handleReceiveMessage);

    return () => {
      socket.off("receive_group_message", handleReceiveMessage);
      if (isMember) {
        socket.emit("leave_group_room", { name: currentUser, room: group._id });
      }
    };
  }, [group, currentUser]);

  const fetchMessages = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/groups/${group._id}/messages`);
      setMessages(res.data);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !isUserInGroup) return;

    try {
      const messageData = {
        room: group._id,
        user: currentUser,
        message: message.trim(),
        timestamp: new Date()
      };

      socket.emit("send_group_message", messageData);
      
     
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/groups/${group._id}/messages`, messageData);
      
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  if (!isUserInGroup) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "100%",
        color: "#999"
      }}>
        You are not a member of this group
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{
        padding: "15px 20px",
        borderBottom: "1px solid #ccc",
        backgroundColor: "#f8f9fa"
      }}>
        <h3 style={{ margin: 0 }}>{group.name}</h3>
        <div style={{ fontSize: "12px", color: "#666" }}>
          Members: {group.members.map(m => m.username).join(", ")}
        </div>
      </div>

      <div style={{
        flex: 1,
        padding: "20px",
        overflowY: "auto",
        backgroundColor: "#fff"
      }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              marginBottom: "15px",
              padding: "10px",
              backgroundColor: msg.user === currentUser ? "#e3f2fd" : "#f5f5f5",
              borderRadius: "8px",
              maxWidth: "70%",
              marginLeft: msg.user === currentUser ? "auto" : "0",
              marginRight: msg.user === currentUser ? "0" : "auto"
            }}
          >
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>
              <strong>{msg.user}</strong>
              {msg.timestamp && (
                <span style={{ float: "right" }}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              )}  
            </div>
            <div>{msg.message || msg.text}</div>
          </div>
        ))}
      </div>

      <div style={{
        padding: "20px",
        borderTop: "1px solid #ccc",
        backgroundColor: "#f8f9fa"
      }}>
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            style={{
              flex: 1,
              padding: "10px",
              border: "1px solid #ccc",
              borderRadius: "5px"
            }}
          />
          <button
            onClick={sendMessage}
            style={{
              padding: "10px 20px",
              backgroundColor: "#3f689b",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer"
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}