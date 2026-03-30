const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();

app.use(cors({
  origin: [
    'http://localhost:5500',
    'http://localhost:3000',
    'https://ledge-stay.up.railway.app'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/auth'));
app.use('/', require('./routes/auth'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/wishlist', require('./routes/wishlist'));

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('DB Error:', err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

