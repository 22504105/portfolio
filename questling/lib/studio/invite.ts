// How a student joins a group: the bot's Mini App link carrying the group's invite code as its start
// parameter (signed by Telegram inside initData, read by the server), or the code typed in the app.

export const BOT_USERNAME = "QuestlingEnglish_bot";

export const inviteLink = (code: string) => `https://t.me/${BOT_USERNAME}?startapp=${code}`;
