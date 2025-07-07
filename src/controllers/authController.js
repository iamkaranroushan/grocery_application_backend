// controllers/authController.js
import jwt from "jsonwebtoken";
import prisma from "../prismaClient.js";
import admin from "../lib/firebaseAdmin.js";



if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
    });
}
// For demo: generate 6-digit OTP
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const generateToken = (tokenData) => {
    return jwt.sign(tokenData, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
};

// 📱 Step 1: User submits phone number
// const sendOtpToPhoneNumber = async (req, res) => {
//     const { phoneNumber } = req.body;

//     if (!phoneNumber) {
//         return res.status(400).json({ error: "Phone number is required." });
//     } else {
//         console.log(phoneNumber);
//     }

//     try {
//         // 🚀 Generate OTP (in real use, store to Redis or send via SMS provider)
//         const otp = generateOtp();

//         // ⏱️ Set expiry for OTP (e.g., 5 mins)
//         const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

//         // Store OTP in DB (can also be in-memory or Redis for prod)
//         await prisma.otpRequest.create({
//             data: {
//                 phoneNumber,
//                 otp,
//                 expiresAt: otpExpiry,
//             },
//         });
//         console.log(`Generated OTP for ${phoneNumber}: ${otp}`);


//         // Normally send SMS here via Twilio, Fast2SMS, etc.

//         res.status(200).json({
//             message: "OTP sent successfully.",
//         });
//     } catch (err) {
//         console.error("OTP send error:", err);
//         res.status(500).json({ error: "Server error" });
//     }
// };

// controllers/authController.js

const verifyOtp = async (req, res) => {
    const { idToken } = req.body;
    console.log("idToken: ", idToken);

    if (!idToken) {
        return res.status(400).json({ error: "ID token is required" });
    }

    try {
        // 🧾 Verify Firebase ID token
        const decoded = await admin.auth().verifyIdToken(idToken);
        const phoneNumber = decoded.phone_number;
        console.log("phone number is:", phoneNumber);

        if (!phoneNumber) {
            return res.status(400).json({ error: "Phone number missing in token" });
        }

        // 🔍 Check or create user in DB
        let user = await prisma.user.findUnique({
            where: { phoneNumber },
            include: {
                cart: true,
                addresses: true,
            },
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    phoneNumber,
                    username: `user${Math.floor(Math.random() * 100000)}`,
                    role: "customer",
                    cart: { create: {} },
                },
                include: {
                    cart: true,
                    addresses: true,
                },
            });
        }

        // 🪙 JWT Token for your session
        const tokenData = {
            id: user.id,
            name: user.username,
            role: user.role,
        };

        const jwtToken = generateToken(tokenData);

        const oneDayInMillis = 24 * 60 * 60 * 1000;
        const isLocal = req.hostname === 'localhost' || req.hostname.startsWith('192.');
        console.log("islocal:",isLocal);
        res.cookie("jwtToken", jwtToken, {
            httpOnly:!isLocal,
            sameSite: isLocal ? "lax" : "none",
            secure: !isLocal,
            maxAge: oneDayInMillis,
        });

        res.json({
            token: jwtToken,
            user,
        });

    } catch (err) {
        console.error("Token verification failed:", err);
        res.status(401).json({ error: "Invalid or expired token" });
    }
};


const logoutUser = async (req, res) => {
    const isLocal = req.hostname === 'localhost' || req.hostname.startsWith('192.');
    try {
        res.clearCookie("jwtToken", {
            httpOnly: !isLocal,
            sameSite: isLocal ? "lax" : "none", // adjust if you're using secure cookies
            secure: !isLocal // true in prod
        });
        res.status(200).json({ message: "Logged out successfully." });
    } catch (err) {
        console.error("Logout error:", err);
        res.status(500).json({ error: "Logout failed" });
    }
};


export default { verifyOtp, logoutUser };