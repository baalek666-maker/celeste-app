import fs from 'fs';
import jwt from 'jsonwebtoken';
const env = fs.readFileSync('.env','utf8');
const m = env.match(/JWT_SECRET="?(.+?)"?\s*$/m);
const secret = m[1].trim();
const token = jwt.sign({id:14}, secret, {expiresIn:'30d'});
console.log(token);
