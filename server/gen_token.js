const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { id: 14, email: 'killuminatibyohm@gmail.com' },
  'ad67c9e5393aace99116270efc5685837ae65fdd30b3b440e35224ca1e1a9d49',
  { expiresIn: '7d' }
);
process.stdout.write(token);
