'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Users, 
  LogOut, 
  Search,
  MoreVertical,
  Paperclip,
  Smile,
  UserPlus,
  MessageSquarePlus,
  ArrowLeft,
  Check,
  CheckCheck,
  Filter
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
  const [groups, setGroups] = useState<Group[]>([
    { id: 'general', name: 'General', members: [] }
  ]);
  
  const [viewMode, setViewMode] = useState<'chats' | 'add_friend' | 'new_group' | 'add_group_members'>('chats');
  const [newFriendName, setNewFriendName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedFriendsForGroup, setSelectedFriendsForGroup] = useState<string[]>([]);
  const [selectedFriendsForAdd, setSelectedFriendsForAdd] = useState<string[]>([]);
  
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getActualRoomId = (chatId: string, isGroup: boolean) => {
    if (isGroup) return chatId;
    return [username, chatId].sort().join('_');
  };

  useEffect(() => {
    const token = localStorage.getItem('jwt');
    const storedUsername = localStorage.getItem('username');

    if (!token || !storedUsername) {
      router.push('/login');
      return;
    }
    
    setUsername(storedUsername);
    const socket = initSocket(token);

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('identify', storedUsername);
      socket.emit('join_room', { room: 'general', username: storedUsername });
    });

    socket.on('disconnect', () => setIsConnected(false));

    socket.on('initial_online_users', (users: string[]) => {
      setGlobalOnline(users);
    });

    socket.on('initial_data', (data: { friends: string[], groups: Group[] }) => {
      setFriends(data.friends);
      setGroups([{ id: 'general', name: 'General', members: [] }, ...data.groups]);
      
      // Auto-join all rooms so we can receive background messages
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

    socket.on('friend_error', (err) => {
      alert(`Error adding friend: ${err}`);
    });

    socket.on('group_created', (group: Group) => {
      setGroups(prev => [...prev, group]);
      setViewMode('chats');
      setActiveChat(`group_${group.id}`);
      setIsGroupChat(true);
      socket.emit('join_room', { room: `group_${group.id}`, username: storedUsername });
    });

    socket.on('group_updated', (updatedGroup: Group) => {
      setGroups(prev => {
        const exists = prev.find(g => g.id === updatedGroup.id);
        if (exists) {
          return prev.map(g => g.id === updatedGroup.id ? updatedGroup : g);
        } else {
          socket.emit('join_room', { room: `group_${updatedGroup.id}`, username: storedUsername });
          return [...prev, updatedGroup];
        }
      });
      setViewMode('chats');
    });

    return () => {
      disconnectSocket();
    };
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChat]);

  // Fetch history when changing active chat
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

    try {
      const socket = getSocket();
      const roomId = getActualRoomId(activeChat, isGroupChat);
      
      const messageData = {
        content: inputMessage,
        room: roomId,
        sender: username,
        timestamp: new Date().toISOString()
      };
      
      socket.emit('send_message', messageData);
      
      await api.post('/api/messages', {
        data: {
          content: inputMessage,
          room: roomId,
          sender: username
        }
      });
      
      setInputMessage('');
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  const addFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendName.trim() || newFriendName === username) return;
    const socket = getSocket();
    socket.emit('add_friend', { from: username, toUsername: newFriendName });
    setNewFriendName('');
  };

  const createGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || selectedFriendsForGroup.length === 0) return;
    const socket = getSocket();
    socket.emit('create_group', { creator: username, name: newGroupName, members: selectedFriendsForGroup });
    setNewGroupName('');
    setSelectedFriendsForGroup([]);
  };

  const addGroupMembers = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFriendsForAdd.length === 0) return;
    
    const groupId = activeChat.replace('group_', '');
    
    const socket = getSocket();
    socket.emit('add_group_members', { 
      groupId, 
      members: selectedFriendsForAdd, 
      adder: username 
    });
    setSelectedFriendsForAdd([]);
  };

  const joinChat = (id: string, isGroup: boolean) => {
    setActiveChat(id);
    setIsGroupChat(isGroup);
  };

  const getChatName = () => {
    if (!isGroupChat) return activeChat;
    const group = groups.find(g => `group_${g.id}` === activeChat || g.id === activeChat);
    return group ? group.name : activeChat;
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 items-center justify-center overflow-hidden font-sans">
      {/* Dynamic Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-slate-900 to-slate-950 z-0"></div>

      <div className="flex w-full max-w-[1600px] h-full lg:h-[94vh] lg:rounded-2xl shadow-2xl border border-white/5 bg-slate-900 relative z-10 overflow-hidden">
        
        {/* ================= LEFT SIDEBAR (DARK THEME) ================= */}
        <div className="w-full md:w-[380px] flex-shrink-0 border-r border-slate-800 flex flex-col bg-slate-900 relative overflow-hidden">
          
          {/* Header */}
          <div className="h-[70px] px-5 flex items-center justify-between flex-shrink-0 z-20 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
            <div className="flex items-center gap-3">
              <img src="https://img.icons8.com/fluency/96/chat--v1.png" alt="ChatIO" className="w-10 h-10" />
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <button onClick={() => setViewMode('add_friend')} title="Add Friend" className="p-2.5 rounded-xl hover:bg-slate-800 hover:text-slate-200 transition-all">
                <UserPlus className="w-5 h-5" />
              </button>
              <button onClick={() => setViewMode('new_group')} title="New Group" className="p-2.5 rounded-xl hover:bg-slate-800 hover:text-slate-200 transition-all">
                <MessageSquarePlus className="w-5 h-5" />
              </button>
              <button 
                onClick={() => {
                  localStorage.clear();
                  router.push('/login');
                }} 
                title="Log Out" 
                className="p-2.5 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="px-5 py-4 flex-shrink-0 z-20">
            <div className="bg-slate-800/80 rounded-xl flex items-center px-4 py-2.5 border border-slate-700/50 focus-within:border-indigo-500/50 focus-within:bg-slate-800 transition-all">
              <Search className="w-4 h-4 text-slate-400 mr-3" />
              <input 
                type="text" 
                placeholder="Search messages..." 
                className="bg-transparent border-none outline-none w-full text-[14px] text-slate-200 placeholder:text-slate-500"
              />
              <button className="text-slate-400 hover:text-slate-200 p-1 ml-2 transition-colors">
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat List */}
          <AnimatePresence mode="wait">
            {viewMode === 'chats' && (
              <motion.div 
                initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
                className="flex-1 overflow-y-auto custom-scrollbar relative"
              >
                {/* Groups */}
                <div className="px-5 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-2">
                  Channels
                </div>
                {groups.map((g) => {
                  const roomId = g.id === 'general' ? 'general' : `group_${g.id}`;
                  const isActive = activeChat === roomId;
                  return (
                    <div 
                      key={roomId}
                      onClick={() => joinChat(roomId, true)}
                      className={`flex items-center mx-3 my-1 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                        isActive ? 'bg-indigo-600/10 border border-indigo-500/20' : 'hover:bg-slate-800/50 border border-transparent'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 flex-shrink-0 ${isActive ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <h3 className={`text-[15px] font-medium truncate ${isActive ? 'text-indigo-400' : 'text-slate-200'}`}># {g.name.toLowerCase()}</h3>
                        </div>
                        <p className="text-[13px] text-slate-500 truncate">{g.members.length} members</p>
                      </div>
                    </div>
                  );
                })}

                {/* Friends */}
                <div className="px-5 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-4">
                  Direct Messages
                </div>
                {friends.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-[13px]">
                    No direct messages yet. Use the + icon to add a friend.
                  </div>
                ) : (
                  friends.map((friend) => {
                    const isOnline = globalOnline.includes(friend);
                    const isActive = activeChat === friend;
                    return (
                      <div 
                        key={friend}
                        onClick={() => joinChat(friend, false)}
                        className={`flex items-center mx-3 my-1 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                          isActive ? 'bg-indigo-600/10 border border-indigo-500/20' : 'hover:bg-slate-800/50 border border-transparent'
                        }`}
                      >
                        <div className="relative flex-shrink-0 mr-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${isActive ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-300'}`}>
                            {friend.charAt(0).toUpperCase()}
                          </div>
                          {isOnline && (
                            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-0.5">
                            <h3 className={`text-[15px] font-medium truncate ${isActive ? 'text-indigo-400' : 'text-slate-200'}`}>{friend}</h3>
                          </div>
                          <p className="text-[13px] text-slate-500 truncate">Tap to chat</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </motion.div>
            )}

            {/* Add Friend View */}
            {viewMode === 'add_friend' && (
              <motion.div 
                initial={{ x: 300 }} animate={{ x: 0 }} exit={{ x: 300 }}
                className="absolute inset-0 bg-slate-900 z-30 flex flex-col"
              >
                <div className="h-[70px] bg-slate-950/50 border-b border-slate-800 flex items-center px-5 text-slate-200 flex-shrink-0">
                  <button onClick={() => setViewMode('chats')} className="mr-4 p-2 hover:bg-slate-800 rounded-xl transition">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-[16px] font-semibold">Add Friend</h2>
                </div>
                <div className="p-6">
                  <p className="text-[14px] text-slate-400 mb-6">
                    Enter your friend's exact username to send a request.
                  </p>
                  <form onSubmit={addFriend} className="space-y-4">
                    <div className="bg-slate-800 rounded-xl p-1 border border-slate-700/50 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
                      <input
                        type="text"
                        value={newFriendName}
                        onChange={(e) => setNewFriendName(e.target.value)}
                        placeholder="Username"
                        className="w-full bg-transparent px-4 py-3 outline-none text-slate-200"
                        required
                      />
                    </div>
                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl font-medium transition-all shadow-lg shadow-indigo-600/20">
                      Send Request
                    </button>
                  </form>
                </div>
              </motion.div>
            )}

            {/* New Group View */}
            {viewMode === 'new_group' && (
              <motion.div 
                initial={{ x: 300 }} animate={{ x: 0 }} exit={{ x: 300 }}
                className="absolute inset-0 bg-slate-900 z-30 flex flex-col"
              >
                <div className="h-[70px] bg-slate-950/50 border-b border-slate-800 flex items-center px-5 text-slate-200 flex-shrink-0">
                  <button onClick={() => setViewMode('chats')} className="mr-4 p-2 hover:bg-slate-800 rounded-xl transition">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-[16px] font-semibold">New Group</h2>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">
                  <form onSubmit={createGroup} className="space-y-6">
                    <div>
                      <div className="bg-slate-800 rounded-xl p-1 border border-slate-700/50 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
                        <input
                          type="text"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          placeholder="Group name"
                          className="w-full bg-transparent px-4 py-3 outline-none text-slate-200"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-[12px] text-slate-400 font-semibold uppercase tracking-wider mb-3 block">Select Members</label>
                      {friends.length === 0 ? (
                        <p className="text-[14px] text-slate-500 bg-slate-800/50 p-4 rounded-xl border border-slate-800">You need to add friends first.</p>
                      ) : (
                        <div className="space-y-1">
                          {friends.map(friend => (
                            <label key={friend} className="flex items-center px-3 py-2 hover:bg-slate-800 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-700/50">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 text-indigo-500 rounded bg-slate-800 border-slate-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                                checked={selectedFriendsForGroup.includes(friend)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedFriendsForGroup(p => [...p, friend]);
                                  else setSelectedFriendsForGroup(p => p.filter(f => f !== friend));
                                }}
                              />
                              <div className="ml-4 flex items-center">
                                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 font-medium text-xs mr-3">
                                  {friend.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-[15px] text-slate-200">{friend}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    <AnimatePresence>
                      {newGroupName.trim() && selectedFriendsForGroup.length > 0 && (
                        <motion.button 
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          type="submit" 
                          className="absolute bottom-8 right-8 w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-all"
                        >
                          <Check className="w-6 h-6" />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </form>
                </div>
              </motion.div>
            )}
            {/* Add Group Members View */}
            {viewMode === 'add_group_members' && (
              <motion.div 
                initial={{ x: 300 }} animate={{ x: 0 }} exit={{ x: 300 }}
                className="absolute inset-0 bg-slate-900 z-30 flex flex-col"
              >
                <div className="h-[70px] bg-slate-950/50 border-b border-slate-800 flex items-center px-5 text-slate-200 flex-shrink-0">
                  <button onClick={() => setViewMode('chats')} className="mr-4 p-2 hover:bg-slate-800 rounded-xl transition">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-[16px] font-semibold">Add Members to {getChatName()}</h2>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">
                  <form onSubmit={addGroupMembers} className="space-y-6">
                    <div>
                      <label className="text-[12px] text-slate-400 font-semibold uppercase tracking-wider mb-3 block">Select Friends to Add</label>
                      {friends.filter(f => !groups.find(g => `group_${g.id}` === activeChat)?.members.includes(f)).length === 0 ? (
                        <p className="text-[14px] text-slate-500 bg-slate-800/50 p-4 rounded-xl border border-slate-800">No new friends available to add.</p>
                      ) : (
                        <div className="space-y-1">
                          {friends
                            .filter(f => !groups.find(g => `group_${g.id}` === activeChat)?.members.includes(f))
                            .map(friend => (
                            <label key={friend} className="flex items-center px-3 py-2 hover:bg-slate-800 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-700/50">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 text-indigo-500 rounded bg-slate-800 border-slate-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                                checked={selectedFriendsForAdd.includes(friend)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedFriendsForAdd(p => [...p, friend]);
                                  else setSelectedFriendsForAdd(p => p.filter(f => f !== friend));
                                }}
                              />
                              <div className="ml-4 flex items-center">
                                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 font-medium text-xs mr-3">
                                  {friend.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-[15px] text-slate-200">{friend}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    <AnimatePresence>
                      {selectedFriendsForAdd.length > 0 && (
                        <motion.button 
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          type="submit" 
                          className="absolute bottom-8 right-8 w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-all"
                        >
                          <Check className="w-6 h-6" />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ================= MAIN CHAT AREA (LIGHT THEME) ================= */}
        <div className="flex-1 flex flex-col bg-slate-50 relative">
          
          {/* Header */}
          <div className="h-[70px] bg-white px-6 flex items-center justify-between z-20 border-b border-slate-200 shadow-sm shadow-slate-200/50">
            <div className="flex items-center gap-4 cursor-pointer">
              <div className="w-[42px] h-[42px] rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-indigo-600 font-bold shadow-sm">
                {getChatName().charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-[16px] text-slate-900 font-semibold leading-tight">
                  {isGroupChat ? getChatName() : activeChat}
                </h2>
                {!isGroupChat && (
                  <p className="text-[13px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                    {globalOnline.includes(activeChat) ? (
                      <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online</>
                    ) : (
                      <><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> Offline</>
                    )}
                  </p>
                )}
                {isGroupChat && activeChat !== 'general' && (() => {
                  const currentGroup = groups.find(g => `group_${g.id}` === activeChat);
                  if (!currentGroup) return null;
                  const onlineCount = currentGroup.members.filter(m => globalOnline.includes(m)).length;
                  return (
                    <p className="text-[13px] text-slate-500 mt-0.5 truncate max-w-[400px]">
                      <span className="text-emerald-500 font-medium">{onlineCount} online</span> • {currentGroup.members.join(', ')}
                    </p>
                  );
                })()}
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              {isGroupChat && activeChat !== 'general' && (
                <button 
                  onClick={() => {
                    setViewMode('add_group_members');
                    setSelectedFriendsForAdd([]);
                  }} 
                  title="Add Members" 
                  className="hover:text-indigo-600 hover:bg-indigo-50 p-2.5 rounded-xl transition-all"
                >
                  <UserPlus className="w-5 h-5" />
                </button>
              )}
              <button className="hover:text-indigo-600 hover:bg-indigo-50 p-2.5 rounded-xl transition-all"><Search className="w-5 h-5" /></button>
              <button className="hover:text-indigo-600 hover:bg-indigo-50 p-2.5 rounded-xl transition-all"><MoreVertical className="w-5 h-5" /></button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 px-4 sm:px-8 py-6 overflow-y-auto space-y-1 relative z-10 custom-scrollbar flex flex-col bg-slate-50">
            {messages.filter(m => m.room === getActualRoomId(activeChat, isGroupChat)).length === 0 && (
              <div className="bg-white border border-slate-200 text-slate-500 text-[13px] px-4 py-3 rounded-xl max-w-sm mx-auto text-center shadow-sm mb-6 mt-auto">
                No messages yet. Send a message to start the conversation.
              </div>
            )}
            
            {messages.filter(m => m.room === getActualRoomId(activeChat, isGroupChat)).map((msg, i, arr) => {
              const isMe = msg.sender === username;
              const isFirstInGroup = i === 0 || arr[i - 1].sender !== msg.sender;
              
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={i} 
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${isFirstInGroup ? 'mt-3' : 'mt-1'}`}
                >
                  <div className={`max-w-[70%] px-4 py-2.5 shadow-sm relative group ${
                    isMe ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200/60 text-slate-800'
                  }`}
                  style={{
                    borderRadius: '16px',
                    borderTopRightRadius: isMe && isFirstInGroup ? '4px' : '16px',
                    borderTopLeftRadius: !isMe && isFirstInGroup ? '4px' : '16px',
                  }}>
                    
                    {!isMe && isGroupChat && isFirstInGroup && (
                      <div className="text-[12px] font-bold text-indigo-500 mb-1 leading-tight">{msg.sender}</div>
                    )}
                    
                    <div className="flex items-end gap-3 flex-wrap">
                      <span className="text-[15px] leading-[22px] break-words">
                        {msg.content}
                      </span>
                      <div className={`text-[11px] flex items-center justify-end gap-1 ml-auto shrink-0 float-right mb[-2px] ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isMe && <CheckCheck className="w-[14px] h-[14px]" />}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="bg-white px-4 sm:px-6 py-4 flex items-end gap-3 z-20 border-t border-slate-200">
            <button className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all rounded-xl flex-shrink-0">
              <Smile className="w-6 h-6" />
            </button>
            <button className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all rounded-xl flex-shrink-0 mr-1">
              <Paperclip className="w-5 h-5" />
            </button>
            <form onSubmit={handleSendMessage} className="flex-1 flex relative">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Message..."
                className="w-full bg-slate-100 border border-transparent focus:border-indigo-500/20 focus:bg-white focus:shadow-sm focus:ring-2 focus:ring-indigo-500/10 rounded-2xl px-5 py-3.5 outline-none text-slate-800 text-[15px] transition-all"
              />
              <AnimatePresence>
                {inputMessage.trim() && (
                  <motion.button
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    type="submit"
                    className="absolute right-2 top-2 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow-md shadow-indigo-600/20"
                  >
                    <Send className="w-4 h-4" />
                  </motion.button>
                )}
              </AnimatePresence>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
