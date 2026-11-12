import mongoose, { Schema, model, models } from 'mongoose';

const UserSchema = new Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    select: false // پسورد به صورت پیش‌فرض در کوئری‌ها نیاید (امنیت)
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  // تنظیمات اختصاصی هر کاربر
  credits: { type: Number, default: 100 }, // کردیت اولیه
  apiConfig: {
    groqKey: { type: String, default: '' },
    azureKey: { type: String, default: '' },
    azureRegion: { type: String, default: 'eastus' }
  },
  createdAt: { type: Date, default: Date.now }
});

// جلوگیری از کامپایل دوباره مدل در Next.js
const User = models.User || model('User', UserSchema);

export default User;