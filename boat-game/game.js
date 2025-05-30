// multiplayer_boat_game.js
// This is a simplified server-client game logic using Node.js and WebSocket

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const server = http.createServer();
server.listen(8080, '0.0.0.0');  // Listen on all interfaces

const wss = new WebSocket.Server({ server });
const rooms = {}; // { roomId: { host, players, state, sequence, progress, finishLine } }

function generateDirectionSequence(length = 20) {
    const directions = ['up', 'right', 'down', 'left'];
    return Array.from({ length }, () => directions[Math.floor(Math.random() * 4)]);
}

function broadcast(roomId, data) {
    rooms[roomId].players.forEach(p => p.ws.send(JSON.stringify(data)));
}

wss.on('connection', ws => {
    ws.on('message', message => {
        let data;
        try {
            data = JSON.parse(message);
        } catch {
            return;
        }

        if (data.type === 'create_room') {
            const roomId = uuidv4();
            rooms[roomId] = {
                host: ws,
                players: [{ id: uuidv4(), ws, progress: 0 }],
                state: 'waiting',
                sequence: [],
                progress: {},
                finishLine: 10
            };
            ws.send(JSON.stringify({ type: 'room_created', roomId }));

        } else if (data.type === 'join_room') {
            const room = rooms[data.roomId];
            if (room && room.state === 'waiting') {
                const player = { id: uuidv4(), ws, progress: 0 };
                room.players.push(player);
                ws.send(JSON.stringify({ type: 'joined', roomId: data.roomId }));
                if (room.players.length >= 2) {
                    room.players.forEach(p => p.ws.send(JSON.stringify({ type: 'ready_to_start' })));
                }
            }

        } else if (data.type === 'start_game') {
            const room = rooms[data.roomId];
            if (room && room.host === ws && room.players.length >= 2) {
                room.state = 'in_game';
                room.sequence = generateDirectionSequence();
                room.players.forEach(p => room.progress[p.id] = 0);
                runGameLoop(room);
            }

        } else if (data.type === 'key_press') {
            const room = rooms[data.roomId];
            if (!room || room.state !== 'in_game') return;
            const expected = room.sequence[0];
            console.log(data.direction + ' ' + expected)
            if (data.direction === expected) {
                const player = room.players.find(p => p.ws === ws);
                room.progress[player.id] += 1;
                if (room.progress[player.id] >= room.finishLine) {
                    room.state = 'finished';
                    broadcast(data.roomId, { type: 'game_over', winner: player.id, progress: room.progress });
                    delete rooms[data.roomId];
                    return;
                }
            }
        }
    });
});

function runGameLoop(room) {
    room.sequence.shift();
    if (room.sequence.length === 0 || room.state !== 'in_game') return;
    const direction = room.sequence[0];
    broadcastRoomDirections(room, direction);
    const delay = Math.random() * 2000 + 1000; // 1s - 3s
    setTimeout(() => runGameLoop(room), delay);
}

function broadcastRoomDirections(room, direction) {
    broadcast(getRoomId(room), { type: 'show_direction', direction, progress: room.progress });
}

function getRoomId(roomObj) {
    return Object.keys(rooms).find(id => rooms[id] === roomObj);
}

console.log('Game server running on ws://localhost:8080');

