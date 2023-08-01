const mongoose = require("mongoose");

let UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    role: {
        type: String,
        default: "customer"
    },
    image: {
        type: String
    },
    sid: {
        type: String,
        required: true
    }
}, {
    timestamps: true
})

module.exports = mongoose.model("user", UserSchema);