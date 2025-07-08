const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");

const User = require("./models/User");
const Cart = require("./models/cart");
const WishlistItem = require("./models/wish");


const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

mongoose.connect("mongodb://127.0.0.1:27017/Plantwebsite", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.log("❌ MongoDB error", err));

// ✅ ORDER SCHEMA
const orderSchema = new mongoose.Schema({
  userId: String,
  email: String, // <-- Store email from frontend
  items: [{
    itemId: String,
    name: String,
    price: Number,
    quantity: Number,
    image: String,
  }],
  totalPrice: Number,
  discount: Number,
  deliveryFee: Number,
  finalAmount: Number,
  orderDate: Date,
  status: { type: String, default: "Pending" }
});
const Order = mongoose.model("Order", orderSchema);

// ✅ ORDER ROUTE with email sending
app.post("/orders", async (req, res) => {
  try {
    const order = new Order(req.body);
    await order.save();

    const userEmail = req.body.email; // ✅ Must be sent from frontend
    const adminEmail = "vansh565.sharma@gmail.com";

    if (!userEmail) {
      return res.status(400).json({ success: false, message: "User email missing" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "sanjuuppal458@gmail.com", // ✅ Your Gmail
        pass: "mtaknqniefogwjzq",        // ✅ App password from Gmail
      },
    });

    const orderSummary = order.items.map(item => (
      `<li>${item.name} x${item.quantity} — ₹${item.price}</li>`
    )).join("");

    const userMailOptions = {
      from: "GreenHaven <sanjuuppal458@gmail.com>",
      to: userEmail,
      subject: "🌿 Order Confirmation - GreenHaven",
      html: `
        <h3>Hi there!</h3>
        <p>Thanks for your order. Here's a quick summary:</p>
        <ul>${orderSummary}</ul>
        <p><strong>Total:</strong> ₹${order.finalAmount}</p>
        <p>We'll notify you once it's shipped. 🌱</p>
      `
    };

    const adminMailOptions = {
      from: "GreenHaven <sanjuuppal458@gmail.com>",
      to: adminEmail,
      subject: `📦 New Order from ${order.userId}`,
      html: `
        <h3>New Order Received</h3>
        <p><strong>User ID:</strong> ${order.userId}</p>
        <p><strong>Email:</strong> ${userEmail}</p>
        <p><strong>Total:</strong> ₹${order.finalAmount}</p>
        <ul>${orderSummary}</ul>
        <p><strong>Placed on:</strong> ${new Date(order.orderDate).toLocaleString()}</p>
      `
    };

    // ✅ Send emails
    await transporter.sendMail(userMailOptions);
    await transporter.sendMail(adminMailOptions);
    await Cart.deleteMany({ email: userEmail }); // or use userId if you prefer



    res.json({ success: true, message: "Order placed", orderId: order._id });

  } catch (err) {
    res.status(500).json({ success: false, message: "Order failed", error: err.message });
  }
});

app.delete("/cart", async (req, res) => {
  try {
    await Cart.deleteMany({});
    res.json({ success: true, message: "All cart items deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/orders", async (req, res) => {
  try {
    await Order.deleteMany({});
    res.json({ success: true, message: "All orders removed" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// ✅ In-memory OTP stores
const emailOtpStore = {};
const mobileOtpStore = {};

// ✅ SEND EMAIL OTP
app.post("/send-email-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  emailOtpStore[email] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "sanjuuppal458@gmail.com",
      pass: "mtaknqniefogwjzq", // 🔒 Gmail App Password
    },
  });

  try {
    await transporter.sendMail({
      from: "GreenHaven <sanjuuppal458@gmail.com>",
      to: email,
      subject: "GreenHaven Email OTP",
      html: `<h3>Your OTP is:</h3><p><strong>${otp}</strong></p>`
    });
    res.json({ success: true, message: "OTP sent to email" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to send OTP", error: err.message });
  }
});

// ✅ VERIFY EMAIL OTP
app.post("/verify-email-otp", (req, res) => {
  const { email, otp } = req.body;
  const stored = emailOtpStore[email];

  if (!stored) return res.json({ success: false, message: "No OTP found" });

  if (stored.otp === otp && Date.now() < stored.expiresAt) {
    delete emailOtpStore[email];
    return res.json({ success: true, message: "✅ Email verified!" });
  } else {
    return res.json({ success: false, message: "❌ Invalid or expired OTP" });
  }
});

// ✅ SEND MOBILE OTP (simulated)
app.post("/send-mobile-otp", async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) return res.status(400).json({ message: "Mobile number is required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  mobileOtpStore[mobile] = otp;

  console.log(`📱 OTP for ${mobile}: ${otp}`);
  res.json({ success: true, message: "OTP sent to mobile (check console)" });
});

// ✅ VERIFY MOBILE OTP
app.post("/verify-mobile-otp", (req, res) => {
  const { mobile, otp } = req.body;

  if (!mobile || !otp) return res.status(400).json({ message: "Mobile and OTP are required" });

  if (mobileOtpStore[mobile] === otp) {
    delete mobileOtpStore[mobile];
    return res.json({ success: true, message: "✅ Mobile number verified!" });
  }

  return res.status(400).json({ success: false, message: "❌ Incorrect OTP" });
});

app.get("/orders", async (req, res) => {
  const orders = await Order.find({});
  res.json(orders);
});


app.delete("/orders/:id", async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});



// ✅ SIGNUP API
app.post("/api/signup", async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.json({ success: false, message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ firstName, lastName, email, password: hashed });
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ LOGIN API
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "Invalid email" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ success: false, message: "Incorrect password" });

    res.json({ success: true, email: user.email }); // ✅ Include email in response
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ CART ROUTES
app.post("/cart", async (req, res) => {
  try {
    const cartItem = new Cart(req.body);
    await cartItem.save();
    res.json({ success: true, message: "Item added to cart" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/cart", async (req, res) => {
  try {
    const items = await Cart.find({});
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/cart/:id", async (req, res) => {
  try {
    await Cart.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/wishlist", async (req, res) => {
  try {
    const item = new WishlistItem(req.body);
    await item.save();
    res.json({ success: true, message: "Item added to wishlist!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error adding item." });
  }
});

// 📥 GET: Get all wishlist items
app.get("/wishlist", async (req, res) => {
  const items = await WishlistItem.find();
  res.json(items);
});

// ❌ DELETE: Remove from wishlist
app.delete("/wishlist/:id", async (req, res) => {
  await WishlistItem.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: "Item removed from wishlist!" });
});


// ✅ Start Server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
