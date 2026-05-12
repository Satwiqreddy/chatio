'use strict';

module.exports = {
  register(/*{ strapi }*/) {},

  async bootstrap({ strapi }) {
    // Auto-grant permissions so the app works out of the box
    try {
      const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'public' },
        populate: ['permissions'],
      });
      const authRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'authenticated' },
        populate: ['permissions'],
      });

      const grantPermission = async (role, action) => {
        if (!role) return;
        const exists = role.permissions?.some(p => p.action === action);
        if (!exists) {
          await strapi.db.query('plugin::users-permissions.permission').create({
            data: { action, role: role.id },
          });
          console.log(`✅ Granted: ${action}`);
        }
      };

      // Public
      await grantPermission(publicRole, 'plugin::users-permissions.auth.callback');
      await grantPermission(publicRole, 'plugin::users-permissions.auth.register');
      await grantPermission(publicRole, 'plugin::users-permissions.auth.connect');

      // Authenticated
      await grantPermission(authRole, 'api::message.message.create');
      await grantPermission(authRole, 'api::message.message.find');
      await grantPermission(authRole, 'api::message.message.findOne');
      
      // New permissions for friends & groups
      await grantPermission(authRole, 'api::friendship.friendship.create');
      await grantPermission(authRole, 'api::friendship.friendship.find');
      await grantPermission(authRole, 'api::chat-group.chat-group.create');
      await grantPermission(authRole, 'api::chat-group.chat-group.find');

      console.log('✅ Permissions bootstrap complete');
    } catch (err) {
      console.error('❌ Error setting permissions:', err.message);
    }

    const { Server } = require('socket.io');

    const io = new Server(strapi.server.httpServer, {
      cors: {
        origin: ['http://localhost:3000', 'https://chatio-pearl.vercel.app'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // Global active users mapping: username -> socketId
    const globalOnlineUsers = new Map();

    io.on('connection', (socket) => {
      console.log('A user connected:', socket.id);

      socket.on('identify', async (username) => {
        socket.data.username = username;
        globalOnlineUsers.set(username, socket.id);
        
        // Broadcast to all that this user is online
        io.emit('user_status_change', { username, status: 'online' });
        
        // Send the user the list of all currently online users
        socket.emit('initial_online_users', Array.from(globalOnlineUsers.keys()));

        try {
          const user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { username }
          });

          if (user) {
            // Fetch Friends
            const friendships = await strapi.db.query('api::friendship.friendship').findMany({
              where: {
                $or: [{ user1: user.id }, { user2: user.id }]
              },
              populate: ['user1', 'user2']
            });
            
            const friends = friendships.map(f => {
              return f.user1.id === user.id ? f.user2.username : f.user1.username;
            });

            // Fetch Groups
            const userGroups = await strapi.db.query('api::chat-group.chat-group').findMany({
              where: {
                members: { id: user.id }
              },
              populate: ['members']
            });

            const groupsData = userGroups.map(g => ({
              id: g.id,
              name: g.name,
              members: g.members.map(m => m.username)
            }));

            // Emit to the user
            socket.emit('initial_data', { friends, groups: groupsData });
          }
        } catch (err) {
          console.error('Error fetching initial data:', err);
        }
      });

      socket.on('add_friend', async ({ from, toUsername }) => {
        try {
          // Find target user
          const targetUser = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { username: toUsername }
          });
          
          if (!targetUser) {
            socket.emit('friend_error', 'User not found');
            return;
          }

          const fromUser = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { username: from }
          });

          // Check if friendship exists
          const existing = await strapi.db.query('api::friendship.friendship').findOne({
            where: {
              $or: [
                { user1: fromUser.id, user2: targetUser.id },
                { user1: targetUser.id, user2: fromUser.id }
              ]
            }
          });

          if (existing) {
            socket.emit('friend_error', 'Already friends');
            return;
          }

          // Create friendship
          await strapi.db.query('api::friendship.friendship').create({
            data: {
              user1: fromUser.id,
              user2: targetUser.id,
              publishedAt: new Date()
            }
          });

          // Notify sender
          socket.emit('friend_added', { username: toUsername });
          
          // Notify target if online
          const targetSocketId = globalOnlineUsers.get(toUsername);
          if (targetSocketId) {
            io.to(targetSocketId).emit('friend_added', { username: from });
          }

        } catch (err) {
          console.error(err);
          socket.emit('friend_error', 'Failed to add friend');
        }
      });

      socket.on('create_group', async ({ creator, name, members }) => {
        try {
          const allMembers = [creator, ...members];
          const users = await strapi.db.query('plugin::users-permissions.user').findMany({
            where: { username: { $in: allMembers } }
          });

          const group = await strapi.db.query('api::chat-group.chat-group').create({
            data: {
              name,
              isPrivate: false,
              members: users.map(u => u.id),
              publishedAt: new Date()
            }
          });

          const groupData = { id: group.id, name: group.name, members: allMembers };

          // Notify all members if they are online
          allMembers.forEach(member => {
            const memberSocketId = globalOnlineUsers.get(member);
            if (memberSocketId) {
              io.to(memberSocketId).emit('group_created', groupData);
            }
          });
        } catch (err) {
          console.error(err);
          socket.emit('group_error', 'Failed to create group');
        }
      });

      socket.on('add_group_members', async ({ groupId, members, adder }) => {
        try {
          const group = await strapi.db.query('api::chat-group.chat-group').findOne({
            where: { id: groupId },
            populate: ['members']
          });

          if (!group) return;

          const newUsers = await strapi.db.query('plugin::users-permissions.user').findMany({
            where: { username: { $in: members } }
          });

          const existingMemberIds = group.members.map(m => m.id);
          const newMemberIds = newUsers.map(u => u.id).filter(id => !existingMemberIds.includes(id));
          
          if (newMemberIds.length === 0) return;

          const updatedMemberIds = [...existingMemberIds, ...newMemberIds];

          const updatedGroup = await strapi.db.query('api::chat-group.chat-group').update({
            where: { id: groupId },
            data: { members: updatedMemberIds },
            populate: ['members']
          });

          const groupData = { 
            id: updatedGroup.id, 
            name: updatedGroup.name, 
            members: updatedGroup.members.map(m => m.username) 
          };

          // Notify ALL members (old and new)
          updatedGroup.members.forEach(member => {
            const memberSocketId = globalOnlineUsers.get(member.username);
            if (memberSocketId) {
              io.to(memberSocketId).emit('group_updated', groupData);
            }
          });

        } catch (err) {
          console.error(err);
          socket.emit('group_error', 'Failed to add members');
        }
      });

      socket.on('join_room', ({ room }) => {
        socket.join(room);
        console.log(`${socket.data.username} joined room: ${room}`);
      });

      socket.on('send_message', async (data) => {
        io.to(data.room).emit('receive_message', data);
      });

      socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const username = socket.data.username;
        if (username) {
          // Keep user online for 45 seconds after they disconnect
          setTimeout(() => {
            // Check if they have reconnected in the meantime
            // If the current socket ID in the map is still this disconnected socket's ID,
            // it means they have NOT reconnected, so we take them offline.
            if (globalOnlineUsers.get(username) === socket.id) {
              globalOnlineUsers.delete(username);
              io.emit('user_status_change', { username, status: 'offline' });
            }
          }, 45000);
        }
      });
    });

    strapi.io = io;
  },
};
