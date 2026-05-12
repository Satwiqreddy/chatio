import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';

let socket: Socket;

export const initSocket = (token: string) => {
  socket = io(API_URL, {
    auth: {
      token,
    },
    transports: ['websocket'],
  });
  return socket;
};

export const getSocket = () => {
  if (!socket) {
    throw new Error('Socket not initialized! Call initSocket first.');
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
  }
};
