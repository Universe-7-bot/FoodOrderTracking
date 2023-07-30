const express = require("express");
const app = express();
const session = require("express-session");
const flash = require("express-flash");
const MongoStore = require("connect-mongo");
const cookieParser = require("cookie-parser");
const { auth } = require("express-openid-connect");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const menu = require("./models/menu.js");
const dotenv = require("dotenv");
dotenv.config();

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

app.get("/", async(req, res) => {
    // console.log(req.oidc.user);
    const allMenu = await menu.find({});
    // console.log(allMenu);
    res.render("index", { isAuthenticated: req.oidc.isAuthenticated(), menu: allMenu, session: req.session });
})

app.get("/get-menu", async (req, res) => {
    const allMenu = await menu.find({});
    res.render("index", { isAuthenticated: req.oidc.isAuthenticated(), menu: allMenu, session: req.session });
})

app.get("/cart", (req, res) => {
    res.render("customers/cart", { isAuthenticated: req.oidc.isAuthenticated() });
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
    else {
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
    }
    return res.json({ totalQty: req.session.cart.totalQty });
})

app.listen(PORT, (error) => {
    if (error) console.log(error);
    else console.log("Server is running on PORT: " + PORT);
})