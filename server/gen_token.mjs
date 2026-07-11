import jwt from 'jsonwebtoken';
import { writeFileSync } from 'fs';
const token = jwt.sign(
  { id: 14, email: 'killuminatibyohm@gmail.com' },
  'ad67c9e5393aace99116270efc5685837ae65fdd30b3b440e35224ca1e1a9d49',
  { expiresIn: '7d' }
);
writeFileSync('/tmp/jwt_token.txt', token, 'utf8');
console.log('Token saved. Length:', token.length);
