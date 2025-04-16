const WebSocket = require('ws');

// URL WebSocket
const url = 'wss://whales.trace.foundation/ws';

// Токен авторизации
const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NDQ3MzM0NTcsImV4cCI6MTc0NDg5MDcyNSwiaWF0IjoxNzQ0ODA0MzI1LCJpZCI6MiwibGlua2VkV2FsbGV0IjoiODhGQmRtNGY3dUJSY0tSR2dhbmJSVHNWcHl4dDlDSmdOenc4N0gzczFBZnQiLCJzdWJFeHBBdCI6MTc1NzM3NjAwMCwidG9wdXBXYWxsZXQiOiJBekVtQ1J4WkI2aGdwOW5KRmJMalRKdFZVclFkOUVSN2pYbURRbXpWejF6OCJ9.RoSRq2g7EUBrMASV26rkjaQLLEHN9bC3KwivdO0rHko';

// Создаем WebSocket-клиент с заголовком Authorization
const ws = new WebSocket(url, {
    headers: {
        Authorization: `Bearer ${accessToken}`
    }
});

// Обработчик события "open" (успешное подключение)
ws.on('open', function open() {
    console.log('Соединение установлено');
    
    // Отправляем сообщение ping
    ws.send('ping');
});

// Обработчик входящих сообщений
ws.on('message', function incoming(data) {
    console.log('Получено сообщение:', data);
});

// Обработчик ошибок
ws.on('error', function error(err) {
    console.error('Ошибка WebSocket:', err);
});

// Обработчик закрытия соединения
ws.on('close', function close(code, reason) {
    console.log('Соединение закрыто:', code, reason);
});
