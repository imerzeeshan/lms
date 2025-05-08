import Course from "../models/Course.js";
import Purchase from "../models/Purchase.js";
import Stripe from "stripe";
import User from "../models/User.js";

export const getUserData = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User Not Found" });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(401).json({ success: false, message: error.message });
  }
};

// Users Enrolled Courses With Lecture Links
export const userEnrolledCourses = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const userData = await User.findById(userId).populate("enrolledCourses");

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res
      .status(200)
      .json({ success: true, enrolledCourses: userData.enrolledCourses || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Purchase Course
export const purchaseCourse = async (req, res) => {
  try {
    const { courseId } = req.body;
    const { origin } = req.headers;
    const userId = req.auth.userId;
    const userData = await User.findById(userId);
    const courseData = await Course.findById(courseId);

    if (!userData || !courseData) {
      return res
        .status(404)
        .json({ success: false, message: "Data Not Found" });
    }

    const purchaseData = {
      courseId: courseData._id,
      userId,
      amount: (
        courseData.coursePrice -
        (courseData.discount * courseData.coursePrice) / 100
      ).toFixed(2),
    };

    const newPurchase = await Purchase.create(purchaseData);

    // Stripe GAteway Initialize
    const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
    const currency = process.env.CURRENCY.toLowerCase();

    // Creating line items to for Stripe
    const line_items = [
      {
        price_data: {
          currency,
          product_data: {
            name: courseData.courseTitle,
          },
          unit_amount: Math.floor(newPurchase.amount) * 100,
        },
        quantity: 1,
      },
    ];

    const session = await stripeInstance.checkout.sessions.create({
      success_url: `${origin}/loading/my-enrollments`,
      cancel_url: `${origin}/`,
      line_items: line_items,
      mode: "payments",
      metadata: {
        purchaseId: newPurchase._id.toString(),
      },
    });

    res.status(200).json({ success: true, session_url: session.url });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
