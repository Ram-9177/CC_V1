const axios = require('axios');
axios.get('http://127.0.0.1:8000/api/rooms/mapping/', {
  headers: {
    Authorization: 'Bearer ' + 'YOUR_TOKEN' // Wait, I can't easily authenticate.
  }
}).then(console.log).catch(console.error);
