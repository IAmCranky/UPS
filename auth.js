const axios = require('axios');

async function getAuth() {
    const creds = `${process.env.UPS_CLIENT_ID}:${process.env.UPS_CLIENT_SECRET}`;
    const encodedCreds = Buffer.from(creds).toString('base64');
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${encodedCreds}`
    };
    const res = await axios.post(
        'https://onlinetools.ups.com/security/v1/oauth/token',
        'grant_type=client_credentials',
        { headers }
    );
    return res.data.access_token; // <<--- THIS IS CRUCIAL!
}
module.exports = getAuth;