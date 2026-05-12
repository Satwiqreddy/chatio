'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Send, Users, LogOut, Search, MoreVertical,
  UserPlus, MessageSquarePlus, ArrowLeft, CheckCheck, X
} from 'lucide-react';
import { initSocket, disconnectSocket, getSocket } from '@/lib/socket';
import api from '@/lib/api';

interface Message {
  id?: string;
  content: string;
  sender: string;
  timestamp: string;
  room: string;
}

interface Group {
  id: string | number;
  name: string;
  members: string[];
}

export default function ChatRoom() {
  const [activeChat, setActiveChat] = useState<string>('general');
  const [isGroupChat, setIsGroupChat] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [username, setUsername] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [globalOnline, setGlobalOnline] = useState<string[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([{ id: 'general', name: 'General', members: [] }]);
  const [viewMode, setViewMode] = useState<'chats' | 'add_friend' | 'new_group' | 'add_group_members'>('chats');
  const [newFriendName, setNewFriendName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedFriendsForGroup, setSelectedFriendsForGroup] = useState<string[]>([]);
  const [selectedFriendsForAdd, setSelectedFriendsForAdd] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getActualRoomId = (chatId: string, isGroup: boolean) => {
    if (isGroup) return chatId;
    return [username, chatId].sort().join('_');
  };

  useEffect(() => {
    const token = localStorage.getItem('jwt');
    const storedUsername = localStorage.getItem('username');
    if (!token || !storedUsername) { router.push('/login'); return; }
    setUsername(storedUsername);
    const socket = initSocket(token);

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('identify', storedUsername);
      socket.emit('join_room', { room: 'general', username: storedUsername });
    });
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('initial_online_users', (users: string[]) => setGlobalOnline(users));
    socket.on('initial_data', (data: { friends: string[], groups: Group[] }) => {
      setFriends(data.friends);
      setGroups([{ id: 'general', name: 'General', members: [] }, ...data.groups]);
      socket.emit('join_room', { room: 'general', username: storedUsername });
      data.friends.forEach(friend => {
        const roomId = [storedUsername, friend].sort().join('_');
        socket.emit('join_room', { room: roomId, username: storedUsername });
      });
      data.groups.forEach(group => {
        socket.emit('join_room', { room: `group_${group.id}`, username: storedUsername });
      });
    });
    socket.on('user_status_change', ({ username, status }) => {
      setGlobalOnline(prev => {
        if (status === 'online' && !prev.includes(username)) return [...prev, username];
        if (status === 'offline') return prev.filter(u => u !== username);
        return prev;
      });
    });
    socket.on('receive_message', (message: Message) => {
      setMessages(prev => [...prev, message]);
    });
    socket.on('friend_added', ({ username }) => {
      setFriends(prev => [...new Set([...prev, username])]);
      setViewMode('chats');
    });
    socket.on('friend_error', (err) => alert(`Error: ${err}`));
    socket.on('group_created', (group: Group) => {
      setGroups(prev => [...prev, group]);
      setViewMode('chats');
      setActiveChat(`group_${group.id}`);
      setIsGroupChat(true);
      getSocket().emit('join_room', { room: `group_${group.id}`, username: storedUsername });
    });
    socket.on('group_updated', (updatedGroup: Group) => {
      setGroups(prev => {
        const exists = prev.find(g => g.id === updatedGroup.id);
        if (exists) return prev.map(g => g.id === updatedGroup.id ? updatedGroup : g);
        getSocket().emit('join_room', { room: `group_${updatedGroup.id}`, username: storedUsername });
        return [...prev, updatedGroup];
      });
      setViewMode('chats');
    });
    return () => { disconnectSocket(); };
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChat]);

  useEffect(() => {
    if (!username) return;
    const fetchHistory = async () => {
      const roomId = getActualRoomId(activeChat, isGroupChat);
      try {
        const res = await api.get(`/api/messages?filters[room][$eq]=${roomId}&sort=createdAt:asc&pagination[limit]=100`);
        const history = res.data.data.map((m: any) => ({
          id: m.id,
          content: m.attributes.content,
          sender: m.attributes.sender || 'Unknown',
          timestamp: m.attributes.createdAt,
          room: m.attributes.room
        }));
        setMessages(history);
      } catch (err) {
        console.error('Failed to fetch history', err);
      }
    };
    fetchHistory();
  }, [activeChat, isGroupChat, username]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    const socket = getSocket();
    const roomId = getActualRoomId(activeChat, isGroupChat);
    const messageData = { content: inputMessage, room: roomId, sender: username, timestamp: new Date().toISOString() };
    socket.emit('send_message', messageData);
    await api.post('/api/messages', { data: { content: inputMessage, room: roomId, sender: username } });
    setInputMessage('');
  };

  const addFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendName.trim() || newFriendName === username) return;
    getSocket().emit('add_friend', { from: username, toUsername: newFriendName });
    setNewFriendName('');
  };

  const createGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || selectedFriendsForGroup.length === 0) return;
    getSocket().emit('create_group', { creator: username, name: newGroupName, members: selectedFriendsForGroup });
    setNewGroupName('');
    setSelectedFriendsForGroup([]);
  };

  const addGroupMembers = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFriendsForAdd.length === 0) return;
    const groupId = activeChat.replace('group_', '');
    getSocket().emit('add_group_members', { groupId, members: selectedFriendsForAdd, adder: username });
    setSelectedFriendsForAdd([]);
  };

  const joinChat = (id: string, isGroup: boolean) => {
    setActiveChat(id);
    setIsGroupChat(isGroup);
    setShowMobileChat(true);
  };

  const getChatName = () => {
    if (!isGroupChat) return activeChat;
    const group = groups.find(g => `group_${g.id}` === activeChat || g.id === activeChat);
    return group ? group.name : activeChat;
  };

  const getChatInitial = () => getChatName().charAt(0).toUpperCase();

  const filteredFriends = friends.filter(f => f.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const currentMessages = messages.filter(m => m.room === getActualRoomId(activeChat, isGroupChat));

  return (
    <div className="flex h-screen bg-[#f0f2f5] overflow-hidden">

      {/* ===== SIDEBAR ===== */}
      <div className={`w-full md:w-[380px] flex-shrink-0 bg-white flex flex-col border-r border-[#e9edef] ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Sidebar Header */}
        <div className="bg-[#f0f2f5] px-4 py-3 flex items-center justify-between border-b border-[#e9edef]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#25d366] rounded-full flex items-center justify-center text-white font-bold text-lg">
              {username.charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold text-[#111b21] text-sm">{username}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setViewMode('new_group')} className="p-2 text-[#54656f] hover:text-[#111b21] hover:bg-[#f5f6f6] rounded-full transition" title="New Group">
              <MessageSquarePlus className="w-5 h-5" />
            </button>
            <button onClick={() => setViewMode('add_friend')} className="p-2 text-[#54656f] hover:text-[#111b21] hover:bg-[#f5f6f6] rounded-full transition" title="Add Friend">
              <UserPlus className="w-5 h-5" />
            </button>
            <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="p-2 text-[#54656f] hover:text-red-500 hover:bg-red-50 rounded-full transition" title="Log Out">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 bg-white border-b border-[#e9edef]">
          <div className="flex items-center bg-[#f0f2f5] rounded-full px-4 py-2 gap-2">
            <Search className="w-4 h-4 text-[#54656f]" />
            <input
              type="text"
              placeholder="Search or start new chat"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm text-[#111b21] placeholder:text-[#8696a0] flex-1"
            />
          </div>
        </div>

        {/* Chat List */}
        {viewMode === 'chats' && (
          <div className="flex-1 overflow-y-auto">
            {/* Groups */}
            {filteredGroups.map(g => {
              const roomId = g.id === 'general' ? 'general' : `group_${g.id}`;
              const isActive = activeChat === roomId;
              return (
                <div
                  key={roomId}
                  onClick={() => joinChat(roomId, true)}
                  className={`flex items-center px-3 py-3 cursor-pointer border-b border-[#f0f2f5] transition ${isActive ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6]'}`}
                >
                  <div className="w-12 h-12 bg-[#25d366] rounded-full flex items-center justify-center text-white font-bold text-lg mr-3 shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-[#111b21] text-[15px]">{g.name}</span>
                    </div>
                    <p className="text-sm text-[#8696a0] truncate">{g.members.length} members</p>
                  </div>
                </div>
              );
            })}

            {/* Divider */}
            {filteredFriends.length > 0 && (
              <div className="px-4 py-2 text-xs font-semibold text-[#8696a0] uppercase tracking-wider bg-[#f0f2f5]">
                Direct Messages
              </div>
            )}

            {/* Friends */}
            {filteredFriends.length === 0 && searchQuery === '' && (
              <div className="p-6 text-center text-[#8696a0] text-sm">
                No friends yet.<br />Click the <UserPlus className="inline w-4 h-4" /> icon to add one.
              </div>
            )}
            {filteredFriends.map(friend => {
              const isOnline = globalOnline.includes(friend);
              const isActive = activeChat === friend;
              return (
                <div
                  key={friend}
                  onClick={() => joinChat(friend, false)}
                  className={`flex items-center px-3 py-3 cursor-pointer border-b border-[#f0f2f5] transition ${isActive ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6]'}`}
                >
                  <div className="relative mr-3 shrink-0">
                    <div className="w-12 h-12 bg-[#128c7e] rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {friend.charAt(0).toUpperCase()}
                    </div>
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#25d366] border-2 border-white rounded-full"></span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-[#111b21] text-[15px]">{friend}</span>
                      {isOnline && <span className="text-xs text-[#25d366] font-medium">online</span>}
                    </div>
                    <p className="text-sm text-[#8696a0] truncate">
                      {isOnline ? 'Active now' : 'Tap to chat'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Friend Panel */}
        {viewMode === 'add_friend' && (
          <div className="flex-1 flex flex-col">
            <div className="bg-[#008069] text-white px-4 py-4 flex items-center gap-4">
              <button onClick={() => setViewMode('chats')} className="hover:bg-white/10 p-1 rounded-full transition">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="font-semibold text-lg">Add Friend</span>
            </div>
            <div className="p-6">
              <p className="text-sm text-[#667781] mb-4">Enter the exact username of the person you want to add.</p>
              <form onSubmit={addFriend} className="space-y-3">
                <input
                  type="text"
                  value={newFriendName}
                  onChange={e => setNewFriendName(e.target.value)}
                  placeholder="Username"
                  required
                  className="w-full border border-[#e9edef] rounded-lg px-4 py-3 text-[#111b21] text-sm focus:border-[#25d366] bg-[#f0f2f5]"
                />
                <button type="submit" className="w-full bg-[#25d366] hover:bg-[#22c55e] text-white font-semibold py-3 rounded-lg transition">
                  Add Friend
                </button>
              </form>
            </div>
          </div>
        )}

        {/* New Group Panel */}
        {viewMode === 'new_group' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-[#008069] text-white px-4 py-4 flex items-center gap-4 shrink-0">
              <button onClick={() => setViewMode('chats')} className="hover:bg-white/10 p-1 rounded-full transition">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="font-semibold text-lg">New Group</span>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <form onSubmit={createGroup} className="space-y-4">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="Group name"
                  required
                  className="w-full border border-[#e9edef] rounded-lg px-4 py-3 text-[#111b21] text-sm focus:border-[#25d366] bg-[#f0f2f5]"
                />
                <p className="text-xs font-semibold text-[#667781] uppercase tracking-wider">Add Participants</p>
                {friends.length === 0 ? (
                  <p className="text-sm text-[#8696a0]">Add friends first to create a group.</p>
                ) : (
                  friends.map(friend => (
                    <label key={friend} className="flex items-center gap-3 p-2 hover:bg-[#f0f2f5] rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedFriendsForGroup.includes(friend)}
                        onChange={e => {
                          if (e.target.checked) setSelectedFriendsForGroup(p => [...p, friend]);
                          else setSelectedFriendsForGroup(p => p.filter(f => f !== friend));
                        }}
                        className="w-4 h-4 accent-[#25d366]"
                      />
                      <div className="w-9 h-9 bg-[#128c7e] rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {friend.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[#111b21] text-sm">{friend}</span>
                    </label>
                  ))
                )}
                {newGroupName.trim() && selectedFriendsForGroup.length > 0 && (
                  <button type="submit" className="w-full bg-[#25d366] hover:bg-[#22c55e] text-white font-semibold py-3 rounded-lg transition">
                    Create Group
                  </button>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Add Group Members Panel */}
        {viewMode === 'add_group_members' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-[#008069] text-white px-4 py-4 flex items-center gap-4 shrink-0">
              <button onClick={() => setViewMode('chats')} className="hover:bg-white/10 p-1 rounded-full transition">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="font-semibold text-lg">Add Members</span>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <form onSubmit={addGroupMembers} className="space-y-3">
                {friends.map(friend => (
                  <label key={friend} className="flex items-center gap-3 p-2 hover:bg-[#f0f2f5] rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFriendsForAdd.includes(friend)}
                      onChange={e => {
                        if (e.target.checked) setSelectedFriendsForAdd(p => [...p, friend]);
                        else setSelectedFriendsForAdd(p => p.filter(f => f !== friend));
                      }}
                      className="w-4 h-4 accent-[#25d366]"
                    />
                    <div className="w-9 h-9 bg-[#128c7e] rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {friend.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[#111b21] text-sm">{friend}</span>
                  </label>
                ))}
                {selectedFriendsForAdd.length > 0 && (
                  <button type="submit" className="w-full bg-[#25d366] text-white font-semibold py-3 rounded-lg transition hover:bg-[#22c55e]">
                    Add {selectedFriendsForAdd.length} Member{selectedFriendsForAdd.length > 1 ? 's' : ''}
                  </button>
                )}
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ===== MAIN CHAT AREA ===== */}
      <div className={`flex-1 flex flex-col ${showMobileChat ? 'flex' : 'hidden md:flex'}`}>
        
        {/* Chat Header */}
        <div className="bg-[#f0f2f5] px-4 py-3 flex items-center justify-between border-b border-[#e9edef]">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1 mr-1" onClick={() => setShowMobileChat(false)}>
              <ArrowLeft className="w-5 h-5 text-[#54656f]" />
            </button>
            <div className="w-10 h-10 bg-[#128c7e] rounded-full flex items-center justify-center text-white font-bold text-lg">
              {getChatInitial()}
            </div>
            <div>
              <p className="font-semibold text-[#111b21] text-[15px] leading-tight">
                {isGroupChat ? getChatName() : activeChat}
              </p>
              {!isGroupChat && (
                <p className="text-xs text-[#8696a0]">
                  {globalOnline.includes(activeChat) ? (
                    <span className="text-[#25d366]">online</span>
                  ) : 'offline'}
                </p>
              )}
              {isGroupChat && activeChat !== 'general' && (() => {
                const g = groups.find(g => `group_${g.id}` === activeChat);
                if (!g) return null;
                const onlineCount = g.members.filter(m => globalOnline.includes(m)).length;
                return <p className="text-xs text-[#8696a0]">{g.members.length} members, {onlineCount} online</p>;
              })()}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isGroupChat && activeChat !== 'general' && (
              <button
                onClick={() => { setViewMode('add_group_members'); setSelectedFriendsForAdd([]); }}
                className="p-2 text-[#54656f] hover:text-[#111b21] hover:bg-white rounded-full transition"
                title="Add Members"
              >
                <UserPlus className="w-5 h-5" />
              </button>
            )}
            <button className="p-2 text-[#54656f] hover:text-[#111b21] hover:bg-white rounded-full transition">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 chat-bg flex flex-col">
          {currentMessages.length === 0 && (
            <div className="m-auto text-center">
              <div className="bg-[#fffde7] text-[#667781] text-sm px-4 py-2 rounded-lg inline-block shadow-sm">
                🔒 Messages are end-to-end visible only here. Say hi!
              </div>
            </div>
          )}

          {currentMessages.map((msg, i, arr) => {
            const isMe = msg.sender === username;
            const isFirstInGroup = i === 0 || arr[i - 1].sender !== msg.sender;
            return (
              <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${isFirstInGroup ? 'mt-3' : 'mt-0.5'}`}>
                <div className={`max-w-[70%] sm:max-w-[55%] px-3 py-2 shadow-sm relative ${isMe ? 'msg-sent' : 'msg-received'}`}>
                  {!isMe && isGroupChat && isFirstInGroup && (
                    <p className="text-xs font-semibold text-[#128c7e] mb-1">{msg.sender}</p>
                  )}
                  <p className="text-[15px] text-[#111b21] leading-snug break-words pr-12">{msg.content}</p>
                  <div className={`absolute bottom-1.5 right-2 flex items-center gap-1 text-[11px] text-[#8696a0]`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isMe && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-[#f0f2f5] px-3 py-3 flex items-center gap-2 border-t border-[#e9edef]">
          <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              placeholder="Type a message"
              className="flex-1 bg-white rounded-full px-5 py-3 text-[15px] text-[#111b21] placeholder:text-[#8696a0] shadow-sm border border-transparent focus:border-[#25d366] transition"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="w-12 h-12 bg-[#25d366] hover:bg-[#22c55e] disabled:bg-[#adb5bd] text-white rounded-full flex items-center justify-center shadow-sm transition"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>

      {/* Empty state when no chat selected on desktop */}
      {!showMobileChat && (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-[#f0f2f5] border-l border-[#e9edef]">
          <div className="w-24 h-24 bg-[#25d366]/10 rounded-full flex items-center justify-center mb-4">
            <MessageSquarePlus className="w-12 h-12 text-[#25d366]" />
          </div>
          <h2 className="text-2xl font-light text-[#41525d] mb-2">ChatIO Web</h2>
          <p className="text-sm text-[#8696a0] text-center max-w-xs">
            Select a chat on the left to start messaging your friends.
          </p>
          <div className="mt-6 flex items-center gap-2 text-xs text-[#8696a0]">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#25d366]' : 'bg-gray-400'}`}></div>
            {isConnected ? 'Connected' : 'Connecting...'}
          </div>
        </div>
      )}
    </div>
  );
}
