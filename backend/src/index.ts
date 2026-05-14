import type { Core } from '@strapi/strapi';
import { Server } from 'socket.io';

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // Auto-grant permissions so the app works out of the box
    try {
      const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'public' },
        populate: ['permissions'] as any,
      });
      const authRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'authenticated' },
        populate: ['permissions'] as any,
      });

      const grantPermission = async (role: any, action: string) => {
        if (!role) return;
        const exists = role.permissions?.some((p: any) => p.action === action);
        if (!exists) {
          await strapi.db.query('plugin::users-permissions.permission').create({
            data: { action, role: role.id },
          });
          console.log(`✅ Granted: ${action}`);
        }
      };

      // Public permissions
      await grantPermission(publicRole, 'plugin::users-permissions.auth.callback');
      await grantPermission(publicRole, 'plugin::users-permissions.auth.register');

      // Authenticated permissions
      await grantPermission(authRole, 'api::message.message.create');
      await grantPermission(authRole, 'api::message.message.find');
      await grantPermission(authRole, 'api::message.message.findOne');
      await grantPermission(authRole, 'api::friendship.friendship.create');
      await grantPermission(authRole, 'api::friendship.friendship.find');
      await grantPermission(authRole, 'api::chat-group.chat-group.create');
      await grantPermission(authRole, 'api::chat-group.chat-group.find');

      // 3. Fix existing friendships to show names in dashboard
    const friendships = await strapi.db.query('api::friendship.friendship').findMany({
      populate: ['user1', 'user2']
    });

    for (const f of friendships) {
      if ((f.user1 && !f.user1_name) || (f.user2 && !f.user2_name)) {
        await strapi.db.query('api::friendship.friendship').update({
          where: { id: f.id },
          data: {
            user1_name: f.user1?.username || f.user1_name,
            user2_name: f.user2?.username || f.user2_name
          }
        });
      }
    }

    console.log('✅ Permissions bootstrap complete');
    } catch (err: any) {
      console.error('❌ Error setting permissions:', err.message);
    }

    // Socket.io Integration
    const io = new Server(strapi.server.httpServer, {
      cors: {
        origin: ['http://localhost:3000', 'https://chatio-pearl.vercel.app'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    const globalOnlineUsers = new Map<string, string>();

    io.on('connection', (socket) => {
      console.log('A user connected:', socket.id);

      socket.on('identify', async (username: string) => {
        socket.data.username = username;
        globalOnlineUsers.set(username, socket.id);
        
        io.emit('user_status_change', { username, status: 'online' });
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
              populate: ['user1', 'user2'] as any
            });
            
            const friends = friendships.map((f: any) => {
              return f.user1.id === user.id ? f.user2.username : f.user1.username;
            });

            // Fetch Groups
            const userGroups = await strapi.db.query('api::chat-group.chat-group').findMany({
              where: {
                members: { id: user.id }
              },
              populate: ['members'] as any
            });

            const groupsData = userGroups.map((g: any) => ({
              id: g.id,
              name: g.name,
              members: g.members.map((m: any) => m.username)
            }));

            socket.emit('initial_data', { friends, groups: groupsData });
          }
        } catch (err) {
          console.error('Error fetching initial data:', err);
        }
      });

      socket.on('add_friend', async ({ from, toUsername }) => {
        try {
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

          await strapi.db.query('api::friendship.friendship').create({
            data: {
              user1: fromUser.id,
              user2: targetUser.id,
              publishedAt: new Date()
            }
          });

          socket.emit('friend_added', { username: toUsername });
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
              members: users.map((u: any) => u.id),
              publishedAt: new Date()
            }
          });

          const groupData = { id: group.id, name: group.name, members: allMembers };

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

      socket.on('join_room', ({ room }) => {
        socket.join(room);
        console.log(`${socket.data.username} joined room: ${room}`);
      });

      socket.on('send_message', async (data) => {
        io.to(data.room).emit('receive_message', data);
      });

      socket.on('disconnect', () => {
        const username = socket.data.username;
        if (username && globalOnlineUsers.get(username) === socket.id) {
          globalOnlineUsers.delete(username);
          io.emit('user_status_change', { username, status: 'offline' });
        }
      });
    });

    (strapi as any).io = io;
  },
};
