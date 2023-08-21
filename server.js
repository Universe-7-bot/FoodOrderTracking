const express = require("express");
const app = express();
const moment = require("moment");
const session = require("express-session");
const flash = require("express-flash");
const MongoStore = require("connect-mongo");
const cookieParser = require("cookie-parser");
const { auth } = require("express-openid-connect");
const bodyParser = require("body-parser");
const Emitter = require("events");
const nodemailer = require("nodemailer");
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

// event emitter
const eventEmitter = new Emitter(); //creating an instance
app.set("eventEmitter", eventEmitter); //can emit an event anywhere in the server.js

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
        res.render("index", { isAuthenticated: req.oidc.isAuthenticated(), menu: allMenu, session: req.session, user: req.oidc.user });
    }
})

app.get("/get-menu", async (req, res) => {
    const allMenu = await menu.find({});
    res.render("index", { isAuthenticated: req.oidc.isAuthenticated(), menu: allMenu, session: req.session });
})

app.get("/cart", (req, res) => {
    res.render("customers/cart", { isAuthenticated: req.oidc.isAuthenticated(), customer: req.oidc.user, session: req.session, user: req.oidc.user });
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

app.post("/remove-item", (req, res) => {
    try {
        const { itemId } = req.body;
        const cart = req.session.cart;
        if (cart.items[itemId]) {
            cart.totalQty -= cart.items[itemId].qty;
            cart.totalPrice -= (cart.items[itemId].qty * cart.items[itemId].item.price);
            delete cart.items[itemId];
            return res.json({ msg: "Item removed from cart", code: 500 });
        }
        return res.json({ msg: "Something went wrong", code: 300 });
    } catch (error) {
        if (error) console.log(error);
    }
})

app.post("/place-order", async (req, res) => {
    try {
        const { email, address, contact } = req.body;
        // console.log(email, address, contact);
        if (address.trim() == "" || contact.trim() == "") {
            return res.json({ msg: "Enter all the fields", code: 300 });
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL,
                pass: process.env.APP_PASSWORD
            },
        });

        const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: 'New order placed!',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>My HTML Page</title>
                </head>
                <body>
                    <h4>Hello from Slice & Bite!</h4>
                    <p>You have successfully placed an order</p>
                    <h4>Thanking you</h4>
                </body>
                </html>
            `,
        };

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

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log(error);
                } else {
                    // console.log(info.response);
                }
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
            res.render("customers/orders", { isAuthenticated: req.oidc.isAuthenticated(), session: req.session, orders: allOrders, moment: moment, user: req.oidc.user })
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
            res.render("admin/orders", { isAuthenticated: req.oidc.isAuthenticated(), session: req.session, orders: allOrders, moment: moment, user: req.oidc.user })
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

        //emit event 
        const eventEmitter = req.app.get("eventEmitter");
        eventEmitter.emit("orderUpdated", { id: orderId, status: orderStatus });

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
            res.render("customers/singleOrder", { isAuthenticated: req.oidc.isAuthenticated(), order: Order, session: req.session, moment: moment, user: req.oidc.user });
        }
        else {
            res.redirect("/");
        }
    } catch (error) {
        if (error) console.log(error);
    }
})

app.get("/checkout-success", (req, res) => {
    res.render("checkoutSuccess", { isAuthenticated: req.oidc.isAuthenticated(), session: req.session, user: req.oidc.user });
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

//catch-all route - unmatched route (404 error)
app.get("*", (req, res) => {
    res.status(404).render("404");
})

//handling 404 error - middleware
// app.use((req, res, next) => {
//     res.status(404).render("404");
// })

const server = app.listen(PORT, (error) => {
    if (error) console.log(error);
    else console.log("Server is running on PORT: " + PORT);
})

// socket.io
const io = require("socket.io")(server);
io.on("connection", (socket) => {
    // console.log(socket.id);
    socket.on("join", (orderId) => { //receiving the event
        // console.log(orderId);
        socket.join(orderId); //creating unique room for a particular order
    })
})

eventEmitter.on("orderUpdated", (data) => {
    io.to(`order-${data.id}`).emit("updated", data); //emit to the particular room
})