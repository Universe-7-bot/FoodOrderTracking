const express = require("express");
const app = express();
const moment = require("moment");
const session = require("express-session");
const flash = require("express-flash");
const MongoStore = require("connect-mongo");
const cookieParser = require("cookie-parser");
const { auth } = require("express-openid-connect");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const menu = require("./models/menu.js");
const user = require("./models/user.js");
const order = require("./models/order.js");
const dotenv = require("dotenv");
dotenv.config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

mongoose.set('strictQuery', false);
mongoose.connect(process.env.DB_URL).then(() => {
    console.log("Connected with database");
}).catch((err) => {
    console.log(err);
})
// const connection = mongoose.connection;

//auth 0 config
const config = {
    authRequired: false,
    auth0Logout: true,
    secret: process.env.SECRET,
    baseURL: process.env.BASE_URL,
    clientID: process.env.CLIENT_ID,
    issuerBaseURL: process.env.ISSUER
};

app.use(session({ //session middleware
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ //session store
        mongoUrl: process.env.DB_URL,
        collectionName: "sessions"
    }),
    cookie: { maxAge: 24 * 60 * 60 * 1000 } //in ms
}))

app.use(flash());

app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(express.json());
app.use(auth(config));

const PORT = process.env.PORT || 5000;

app.get("/", async (req, res) => {
    // console.log(req.oidc.user);
    const allMenu = await menu.find({});
    // console.log(allMenu);
    if (!req.oidc.isAuthenticated()) {
        res.render("index", { isAuthenticated: req.oidc.isAuthenticated(), menu: allMenu, session: req.session });
    }
    else {
        const existingUser = await user.findOne({ email: req.oidc.user.email });
        if (!existingUser) {
            const newUser = new user({
                name: req.oidc.user.name,
                email: req.oidc.user.email,
                image: req.oidc.user.picture,
                sid: req.oidc.user.sid
            })
            await newUser.save();
        }
        res.render("index", { isAuthenticated: req.oidc.isAuthenticated(), menu: allMenu, session: req.session });
    }
})

app.get("/get-menu", async (req, res) => {
    const allMenu = await menu.find({});
    res.render("index", { isAuthenticated: req.oidc.isAuthenticated(), menu: allMenu, session: req.session });
})

app.get("/cart", (req, res) => {
    res.render("customers/cart", { isAuthenticated: req.oidc.isAuthenticated(), customer: req.oidc.user, session: req.session });
})

app.post("/update-cart", (req, res) => {
    const item = req.body;
    // console.log(req.body);
    if (!req.session.cart) {
        req.session.cart = {
            items: {},
            totalQty: 0,
            totalPrice: 0
        }
    }
    let cart = req.session.cart;
    if (!cart.items[item._id]) { //item not present in the cart
        cart.items[item._id] = {
            item: item,
            qty: 1
        }
        cart.totalQty += 1;
        cart.totalPrice += item.price;
    }
    else {
        cart.items[item._id].qty += 1;
        cart.totalQty += 1;
        cart.totalPrice += item.price;
    }
    return res.json({ totalQty: req.session.cart.totalQty });
})

app.post("/place-order", async (req, res) => {
    try {
        const { email, address, contact } = req.body;
        // console.log(email, address, contact);
        if (address.trim() == "" || contact.trim() == "") {
            return res.json({ msg: "Enter all the fields", code: 300 });
        }
        const customer = await user.findOne({ email: email });
        if (customer) {
            // console.log(customer);
            const newOrder = new order({
                customer: customer,
                items: req.session.cart.items,
                phone: contact,
                address: address
            });
            newOrder.save().then(() => {
            });
            delete req.session.cart;
            return res.json({ msg: "Order placed successfully", code: 500 });
        }
        return res.json({ msg: "Something went wrong", code: 404 });
    } catch (error) {
        if (error) console.log(error);
    }
})

app.get("/orders", async (req, res) => {
    try {
        const existingCustomer = await user.findOne({ email: req.oidc.user.email });
        // console.log(existingCustomer);
        if (existingCustomer) {
            const allOrders = await order.find({
                   "customer._id": existingCustomer._id
            })
            // console.log(allOrders);
            res.render("customers/orders", {isAuthenticated: req.oidc.isAuthenticated(), session: req.session, orders: allOrders, moment: moment})
        }
    } catch (error) {
        if (error) console.log(error);
    }
})

app.get("/admin-orders", async (req, res) => {
    try {
        const existingCustomer = await user.findOne({ email: req.oidc.user.email });
        if (existingCustomer) {
            const allOrders = await order.find({
                status: {
                    $ne: "completed"
                }
            })
            // console.log(allOrders);
            res.render("admin/orders", { isAuthenticated: req.oidc.isAuthenticated(), session: req.session, orders: allOrders, moment: moment })
        }
    } catch (error) {
        if (error) console.log(error);
    }
})

app.post("/update-order-status", (req, res) => {
    try {
        const { orderId, orderStatus } = req.body;
        // console.log(orderId, orderStatus);
        order.updateOne({
            _id: new ObjectId(orderId)
        }, {
            $set: {
                status: orderStatus
            }
        }).then(() => {

        })
        return res.json({ msg: "order status updated" });
    } catch(error) {
        if (error) console.log(error);
    }
})

app.get("/track-order/:id", async (req, res) => {
    try {
        const User = await user.findOne({
            email: req.oidc.user.email
        })
        const Order = await order.findOne({
            _id: new ObjectId(req.params.id)
        })
        if (User._id.toString() == Order.customer._id.toString()) { //order placed by authenticated customer
            res.render("customers/singleOrder", { isAuthenticated: req.oidc.isAuthenticated(), order: Order, session: req.session });
        }
        else {
            res.redirect("/");
        }
    } catch (error) {
        if (error) console.log(error);
    }
})

app.get("/checkout-success", (req, res) => {
    res.render("checkoutSuccess", { isAuthenticated: req.oidc.isAuthenticated(), session: req.session });
})

app.post('/create-checkout-session', async (req, res) => {
    const items = Object.values(req.session.cart.items);
    // console.log(items);
    const line_items = items.map((obj) => { //map returns an array of objects
        const imageUrl = "public" + obj.item.image;
        return {
            price_data: {
                currency: 'inr',
                product_data: {
                    name: obj.item.name,
                    images: [imageUrl],
                    metadata: {
                        id: obj.item._id
                    }
                },
                unit_amount: obj.item.price * 100,
            },
            quantity: obj.qty
        }
    })
    // console.log(line_items);
    const session = await stripe.checkout.sessions.create({
        line_items,
        mode: 'payment',
        success_url: 'http://localhost:3000/checkout-success',
        cancel_url: 'http://localhost:3000',
    });

    res.json({ url: session.url });
});


app.listen(PORT, (error) => {
    if (error) console.log(error);
    else console.log("Server is running on PORT: " + PORT);
})