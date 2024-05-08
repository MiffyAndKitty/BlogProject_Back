import admin from 'firebase-admin';
import * as serviceAccount from '../../firebase-account.json';

const firebaseConfig = serviceAccount as admin.ServiceAccount;

admin.initializeApp({
  credential: admin.credential.cert(firebaseConfig)
});

export default admin;
