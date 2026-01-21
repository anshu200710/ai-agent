import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    console.log('Using MONGO_URI:', process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);

    // await mongoose.connect(process.env.MONGO_URI, {
    //   serverSelectionTimeoutMS: 5000,
    //   family: 4
    // });

    console.log('✅ MongoDB Atlas connected (NON-SRV)');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

export default connectDB;
