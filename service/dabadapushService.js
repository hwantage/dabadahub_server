const pushModel = require('../model/dabadapushModel');

let clients = [];

const handleStream = (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Extract client IP
  let clientIp = req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress;
  if (clientIp.includes('::ffff:')) {
    clientIp = clientIp.split('::ffff:')[1];
  }

  const newClient = {
    id: Date.now() + Math.random(),
    ip: clientIp,
    res: res
  };

  clients.push(newClient);
  console.log(`[SSE Connected] IP: ${clientIp} (Total clients: ${clients.length})`);

  // Send initial keep-alive
  res.write('retry: 10000\n\n');

  req.on('close', () => {
    clients = clients.filter(client => client.id !== newClient.id);
    console.log(`[SSE Disconnected] IP: ${clientIp}`);
  });
};

const sendPush = (targetIp, type, title, message, actionUrl) => {
  return new Promise((resolve, reject) => {
    const targetClients = clients.filter(client => client.ip === targetIp);

    if (targetClients.length === 0) {
      console.log(`[Push Failed] No client connected for IP: ${targetIp}`);
      return resolve({ success: false, message: `No client connected for IP: ${targetIp}` });
    }

    // Save to Database
    pushModel.savePushMessage(targetIp, type, title, message, actionUrl, (err, savedData) => {
      if (err) {
        console.error('Error saving push message to DB:', err);
        return resolve({ success: false, message: 'Internal Server Error' });
      }

      const newPushId = savedData.id;
      
      // Use standard popup path with id parameter
      const popupUrl = `/push-popup?ip=${targetIp}&newPushId=${newPushId}`;

      targetClients.forEach(client => {
        // SSE Payload
        client.res.write(`data: ${JSON.stringify({ id: newPushId, type: type || 'default', title, message, url: popupUrl })}\n\n`);
      });

      console.log(`[Push Sent] IP: ${targetIp}, ID: ${newPushId}`);
      resolve({ success: true, message: `Push sent to ${targetIp}`, id: newPushId });
    });
  });
};

const getPushList = (req, res) => {
  const ip = req.query.ip;
  if (!ip) return res.status(400).json({ success: false, message: 'IP is required' });

  pushModel.getPushList(ip, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
    res.json({ success: true, data: rows });
  });
};

const readPush = (req, res) => {
  const id = req.body.id || req.query.id;
  const ip = req.body.ip || req.query.ip;

  if (!id || !ip) {
    return res.status(400).json({ success: false, message: 'ID and IP are required' });
  }

  pushModel.markAsRead(id, ip, (err, updated) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
    res.json({ success: true, message: 'Marked as read', updated });
  });
};

const getPushMessageById = (req, res) => {
  const id = req.query.id;
  const ip = req.query.ip;

  if (!id || !ip) return res.status(400).json({ success: false, message: 'ID and IP required' });

  pushModel.getPushMessageById(id, ip, (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
    if (row) {
      res.json({ success: true, data: row });
    } else {
      res.status(404).json({ success: false, message: 'Not found' });
    }
  });
};

// Backward compatibility or simply ignore it if we fully replaced pushData
const getPushPageData = (req, res) => {
  // Redirecting getPushPageData to getPushMessageById if newPushId is passed
  // However, popup.html will be updated to call /api/push-message or /api/push-list.
  // Leaving this function empty or return 404 for now, as we'll modify frontend.
  res.status(400).json({ success: false, message: 'Deprecated API. Use /api/push-message and /api/push-list' });
};

module.exports = {
  handleStream,
  sendPush,
  getPushPageData,
  getPushList,
  readPush,
  getPushMessageById
};
