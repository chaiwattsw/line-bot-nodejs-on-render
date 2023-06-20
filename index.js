require("dotenv").config();
const express = require("express");
const { Client } = require("@line/bot-sdk");
const { createClient } = require("@supabase/supabase-js");
const cron = require("node-cron");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const isSameOrAfter = require("dayjs/plugin/isSameOrAfter");

dayjs.extend(utc);
dayjs.extend(isSameOrAfter);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const lineConfig = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET,
};

const lineClient = new Client(lineConfig);

const app = express();

app.use(express.json());
app.use(
    express.urlencoded({
        extended: true,
    }),
);

app.post("/webhook", async (req, res) => {
    const events = req.body.events;

    for (const event of events) {
        if (
            event.type === "message" &&
            event.message.type === "text" &&
            event.message.text === "สู้ต่อไป"
        ) {
            await sendReminderMessages(); // Trigger the reminder job
        }
    }

    res.status(200).end();
});

// Define function to get passports to send reminders
async function getPassportsToSendReminders() {
    const currentDate = dayjs().utc(); // Get current UTC date and time
    const thirtyDaysLater = currentDate.add(30, "days");
    const fortyFiveDaysLater = currentDate.add(45, "days");

    // Query the passports table for records matching the conditions
    const { data, error } = await supabase
        .from("passports")
        .select("*")
        .where((passport) =>
            passport("visa_date")
                .isSameOrAfter(currentDate)
                .and(passport("visa_date").isBefore(fortyFiveDaysLater))
                .or(passport("visa_date").isSame(thirtyDaysLater, "day")),
        )
        .limit(3); // Adjust the limit to retrieve three passports

    if (error) {
        console.error(error);
        return [];
    }

    return data || [];
}

// Define function to send reminder messages
async function sendReminderMessages() {
    const passports = await getPassportsToSendReminders();

    for (const passport of passports) {
        const userId = passport.user_id; // Assuming there is a user_id column in the passports table

        const flexMessage = {
            type: "flex",
            altText: "Visa Expiry Reminder",
            contents: {
                type: "bubble",
                hero: {
                    type: "image",
                    url: "https://example.com/image.jpg",
                    size: "full",
                    aspectRatio: "20:13",
                    aspectMode: "cover",
                },
                body: {
                    type: "box",
                    layout: "vertical",
                    spacing: "md",
                    contents: [
                        {
                            type: "text",
                            text: `💀 แจ้งเตือนวีซ่า TR60 ${passport.passport_no} ใกล้หมดอายุ 💀`,
                            weight: "bold",
                            size: "md",
                        },
                        {
                            type: "box",
                            layout: "vertical",
                            spacing: "sm",
                            contents: [
                                {
                                    type: "text",
                                    text: `❌ Name-Surname: ${passport.name_surname}`,
                                    size: "md",
                                },
                                {
                                    type: "text",
                                    text: `❌ Passport No.: ${passport.passport_no}`,
                                    size: "md",
                                },
                                {
                                    type: "text",
                                    text: `❌ Expired date: ${passport.expired_date}`,
                                    size: "md",
                                },
                                {
                                    type: "text",
                                    text: `❌ Agent: ${passport.agent}`,
                                    size: "md",
                                },
                            ],
                        },
                    ],
                },
            },
        };

        try {
            // Send the message using the LINE Bot SDK or your preferred messaging service
            await lineClient.pushMessage(userId, flexMessage);
            console.log(`Message sent to user ${userId}`);
        } catch (err) {
            console.error(`Failed to send message to user ${userId}:`, err);
        }
    }
}

// Schedule the sendReminderMessages function to run every day at 3:00 PM UTC
cron.schedule("0 15 * * *", sendReminderMessages); // Runs once every day at 3:00 PM UTC

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
