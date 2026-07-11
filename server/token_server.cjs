// Generate token and inject directly into localStorage
const jwt = require('jsonwebtoken');
const http = require('http');
const token = jwt.sign(
  { id: 14, email: 'killuminatibyohm@gmail.com' },
  'ad67c9e5393aace99116270efc5685837ae65fdd30b3b440e35224ca1e1a9d49',
  { expiresIn: '7d' }
);

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ token }));
});
server.listen(9876, () => console.log('Token server on :9876'));
