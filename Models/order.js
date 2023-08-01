const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
    customer: {},
    items: {
        type: Object,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    paymentType: {
        type: String,
        default: "COD"
    },
    status: {
        type: String,
        default: "order_placed"
    }
}, {
    timestamps: true
})

module.exports = mongoose.model("order", OrderSchema);