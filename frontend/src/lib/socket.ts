import { io, Socket } from 'socket.io-client'

let socket: Socket

export const getSocket = (): Socket => {
	if (!socket) {
		socket = io({ path: '/socket.io', withCredentials: true })
	}
	return socket
}
