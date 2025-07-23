const User = require('../models/User'); // Adjust path as needed

module.exports = async function userApiKeyAuth(req, res, next) {
  try {
    //  console.log('request received :',req);
    const apiKey = req.header('x-api-key');
    const email = req.params.email; // Assumes user email is in the route param
    // console.log(`API Key: ${apiKey}, Email: ${email}`);

    if (!apiKey || !email) {
      return res.status(401).json({ error: 'Unauthorized: Missing API key or email' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    // Check if any stored API key matches the provided key
    const validKey = user.apiKeys.some(k => k.key === apiKey);
    if (!validKey) {
      return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
    }
    
    req.user = user; // Optionally attach user to request for downstream use
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
