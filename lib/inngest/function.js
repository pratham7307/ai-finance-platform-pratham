// import { inngest } from "./client";
// import { db } from "@/lib/prisma";
// import EmailTemplate from "@/emails/template";
// import { sendEmail } from "@/actions/send-email";
// //import { GoogleGenerativeAI } from "@google/generative-ai";

// // 1. Recurring Transaction Processing with Throttling
// export const processRecurringTransaction = inngest.createFunction(
//   {
//     id: "process-recurring-transaction",
//     name: "Process Recurring Transaction",
//     throttle: {
//       limit: 10, // Process 10 transactions
//       period: "1m", // per minute
//       key: "event.data.userId", // Throttle per user
//     },
//   },
//   { event: "transaction.recurring.process" },
//   async ({ event, step }) => {
//     // Validate event data
//     if (!event?.data?.transactionId || !event?.data?.userId) {
//       console.error("Invalid event data:", event);
//       return { error: "Missing required event data" };
//     }

//     await step.run("process-transaction", async () => {
//       const transaction = await db.transaction.findUnique({
//         where: {
//           id: event.data.transactionId,
//           userId: event.data.userId,
//         },
//         include: {
//           account: true,
//         },
//       });

//       if (!transaction || !isTransactionDue(transaction)) return;

//       // Create new transaction and update account balance in a transaction
//       await db.$transaction(async (tx) => {
//         // Create new transaction
//         await tx.transaction.create({
//           data: {
//             type: transaction.type,
//             amount: transaction.amount,
//             description: `${transaction.description} (Recurring)`,
//             date: new Date(),
//             category: transaction.category,
//             userId: transaction.userId,
//             accountId: transaction.accountId,
//             isRecurring: false,
//           },
//         });

//         // Update account balance
//         const balanceChange =
//           transaction.type === "EXPENSE"
//             ? -transaction.amount.toNumber()
//             : transaction.amount.toNumber();

//         await tx.account.update({
//           where: { id: transaction.accountId },
//           data: { balance: { increment: balanceChange } },
//         });

//         // Update last processed date and next recurring date
//         await tx.transaction.update({
//           where: { id: transaction.id },
//           data: {
//             lastProcessed: new Date(),
//             nextRecurringDate: calculateNextRecurringDate(
//               new Date(),
//               transaction.recurringInterval
//             ),
//           },
//         });
//       });
//     });
//   }
// );

// // Trigger recurring transactions with batching
// export const triggerRecurringTransactions = inngest.createFunction(
//   {
//     id: "trigger-recurring-transactions", // Unique ID,
//     name: "Trigger Recurring Transactions",
//   },
//   { cron: "0 0 * * *" }, // Daily at midnight
//   async ({ step }) => {
//     const recurringTransactions = await step.run(
//       "fetch-recurring-transactions",
//       async () => {
//         return await db.transaction.findMany({
//           where: {
//             isRecurring: true,
//             status: "COMPLETED",
//             OR: [
//               { lastProcessed: null },
//               {
//                 nextRecurringDate: {
//                   lte: new Date(),
//                 },
//               },
//             ],
//           },
//         });
//       }
//     );

//     // Send event for each recurring transaction in batches
//     if (recurringTransactions.length > 0) {
//       const events = recurringTransactions.map((transaction) => ({
//         name: "transaction.recurring.process",
//         data: {
//           transactionId: transaction.id,
//           userId: transaction.userId,
//         },
//       }));

//       // Send events directly using inngest.send()
//       await inngest.send(events);
//     }

//     return { triggered: recurringTransactions.length };
//   }
// );

// // 2. Monthly Report Generation
// async function generateFinancialInsights(stats, month) {
//   const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
//   const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

//   const prompt = `
//     Analyze this financial data and provide 3 concise, actionable insights.
//     Focus on spending patterns and practical advice.
//     Keep it friendly and conversational.

//     Financial Data for ${month}:
//     - Total Income: $${stats.totalIncome}
//     - Total Expenses: $${stats.totalExpenses}
//     - Net Income: $${stats.totalIncome - stats.totalExpenses}
//     - Expense Categories: ${Object.entries(stats.byCategory)
//       .map(([category, amount]) => `${category}: $${amount}`)
//       .join(", ")}

//     Format the response as a JSON array of strings, like this:
//     ["insight 1", "insight 2", "insight 3"]
//   `;

//   try {
//     const result = await model.generateContent(prompt);
//     const response = result.response;
//     const text = response.text();
//     const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

//     return JSON.parse(cleanedText);
//   } catch (error) {
//     console.error("Error generating insights:", error);
//     return [
//       "Your highest expense category this month might need attention.",
//       "Consider setting up a budget for better financial management.",
//       "Track your recurring expenses to identify potential savings.",
//     ];
//   }
// }

// export const generateMonthlyReports = inngest.createFunction(
//   {
//     id: "generate-monthly-reports",
//     name: "Generate Monthly Reports",
//   },
//   { cron: "0 0 1 * *" }, // First day of each month
//   async ({ step }) => {
//     const users = await step.run("fetch-users", async () => {
//       return await db.user.findMany({
//         include: { accounts: true },
//       });
//     });

//     for (const user of users) {
//       await step.run(`generate-report-${user.id}`, async () => {
//         const lastMonth = new Date();
//         lastMonth.setMonth(lastMonth.getMonth() - 1);

//         const stats = await getMonthlyStats(user.id, lastMonth);
//         const monthName = lastMonth.toLocaleString("default", {
//           month: "long",
//         });

//         // Generate AI insights
//         const insights = await generateFinancialInsights(stats, monthName);

//         await sendEmail({
//           to: user.email,
//           subject: `Your Monthly Financial Report - ${monthName}`,
//           react: EmailTemplate({
//             userName: user.name,
//             type: "monthly-report",
//             data: {
//               stats,
//               month: monthName,
//               insights,
//             },
//           }),
//         });
//       });
//     }

//     return { processed: users.length };
//   }
// );

// // 3. Budget Alerts with Event Batching
// export const checkBudgetAlerts = inngest.createFunction(
//   { id:"Check Budget Alerts",
//     name: "Check Budget Alerts" 
//   },
//   { cron: "0 */6 * * *" }, // Every 6 hours
//   async ({ step }) => {
//     const budgets = await step.run("fetch-budgets", async () => {
//       return await db.budget.findMany({
//         include: {
//           user: {
//             include: {
//               accounts: {
//                 where: {
//                   isDefault: true,
//                 },
//               },
//             },
//           },
//         },
//       });
//     });

//     for (const budget of budgets) {
//       const defaultAccount = budget.user.accounts[0];
//       if (!defaultAccount) continue; // Skip if no default account

//       await step.run(`check-budget-${budget.id}`, async () => {
//         const startDate = new Date();
//         startDate.setDate(1); // Start of current month

//         // Calculate total expenses for the default account only
//         const expenses = await db.transaction.aggregate({
//           where: {
//             userId: budget.userId,
//             accountId: defaultAccount.id, // Only consider default account
//             type: "EXPENSE",
//             date: {
//               gte: startDate,
//             },
//           },
//           _sum: {
//             amount: true,
//           },
//         });

//         const totalExpenses = expenses._sum.amount?.toNumber() || 0;
//         const budgetAmount = budget.amount;
//         const percentageUsed = (totalExpenses / budgetAmount) * 100;

//         // Check if we should send an alert
//         if (
//           percentageUsed >= 1 && // Default threshold of 80%
//           (!budget.lastAlertSent ||
//             isNewMonth(new Date(budget.lastAlertSent), new Date()))
//         ) {
//           await sendEmail({
//             to: budget.user.email,
//             subject: `Budget Alert for ${defaultAccount.name}`,
//             react: EmailTemplate({
//               userName: budget.user.name,
//               type: "budget-alert",
//               data: {
//                 percentageUsed,
//                 budgetAmount: parseInt(budgetAmount).toFixed(1),
//                 totalExpenses: parseInt(totalExpenses).toFixed(1),
//                 accountName: defaultAccount.name,
//               },
//             }),
//           });

//           // Update last alert sent
//           await db.budget.update({
//             where: { id: budget.id },
//             data: { lastAlertSent: new Date() },
//           });
//         }
//       });
//     }
//   }
// );

// function isNewMonth(lastAlertDate, currentDate) {
//   return (
//     lastAlertDate.getMonth() !== currentDate.getMonth() ||
//     lastAlertDate.getFullYear() !== currentDate.getFullYear()
//   );
// }

// // Utility functions
// function isTransactionDue(transaction) {
//   // If no lastProcessed date, transaction is due
//   if (!transaction.lastProcessed) return true;

//   const today = new Date();
//   const nextDue = new Date(transaction.nextRecurringDate);

//   // Compare with nextDue date
//   return nextDue <= today;
// }

// function calculateNextRecurringDate(date, interval) {
//   const next = new Date(date);
//   switch (interval) {
//     case "DAILY":
//       next.setDate(next.getDate() + 1);
//       break;
//     case "WEEKLY":
//       next.setDate(next.getDate() + 7);
//       break;
//     case "MONTHLY":
//       next.setMonth(next.getMonth() + 1);
//       break;
//     case "YEARLY":
//       next.setFullYear(next.getFullYear() + 1);
//       break;
//   }
//   return next;
// }

// async function getMonthlyStats(userId, month) {
//   const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
//   const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

//   const transactions = await db.transaction.findMany({
//     where: {
//       userId,
//       date: {
//         gte: startDate,
//         lte: endDate,
//       },
//     },
//   });

//   return transactions.reduce(
//     (stats, t) => {
//       const amount = t.amount.toNumber();
//       if (t.type === "EXPENSE") {
//         stats.totalExpenses += amount;
//         stats.byCategory[t.category] =
//           (stats.byCategory[t.category] || 0) + amount;
//       } else {
//         stats.totalIncome += amount;
//       }
//       return stats;
//     },
//     {
//       totalExpenses: 0,
//       totalIncome: 0,
//       byCategory: {},
//       transactionCount: transactions.length,
//     }
//   );
// }
// import { inngest } from "./client";
// import { db } from "@/lib/prisma";
// import EmailTemplate from "@/emails/template";
// import { sendEmail } from "@/actions/send-email";

// // 1. Recurring Transaction Processing with Throttling
// export const processRecurringTransaction = inngest.createFunction(
//   {
//     id: "process-recurring-transaction",
//     name: "Process Recurring Transaction",
//     throttle: {
//       limit: 10,
//       period: "1m",
//       key: "event.data.userId",
//     },
//   },
//   { event: "transaction.recurring.process" },
//   async ({ event, step }) => {
//     if (!event?.data?.transactionId || !event?.data?.userId) {
//       console.error("Invalid event data:", event);
//       return { error: "Missing required event data" };
//     }

//     await step.run("process-transaction", async () => {
//       const transaction = await db.transaction.findUnique({
//         where: {
//           id: event.data.transactionId,
//           userId: event.data.userId,
//         },
//         include: { account: true },
//       });

//       if (!transaction || !isTransactionDue(transaction)) return;

//       await db.$transaction(async (tx) => {
//         await tx.transaction.create({
//           data: {
//             type: transaction.type,
//             amount: transaction.amount,
//             description: `${transaction.description} (Recurring)`,
//             date: new Date(),
//             category: transaction.category,
//             userId: transaction.userId,
//             accountId: transaction.accountId,
//             isRecurring: false,
//           },
//         });

//         const balanceChange =
//           transaction.type === "EXPENSE"
//             ? -transaction.amount.toNumber()
//             : transaction.amount.toNumber();

//         await tx.account.update({
//           where: { id: transaction.accountId },
//           data: { balance: { increment: balanceChange } },
//         });

//         await tx.transaction.update({
//           where: { id: transaction.id },
//           data: {
//             lastProcessed: new Date(),
//             nextRecurringDate: calculateNextRecurringDate(
//               new Date(),
//               transaction.recurringInterval
//             ),
//           },
//         });
//       });
//     });
//   }
// );

// // 2. Trigger Recurring Transactions
// export const triggerRecurringTransactions = inngest.createFunction(
//   {
//     id: "trigger-recurring-transactions",
//     name: "Trigger Recurring Transactions",
//   },
//   { cron: "0 0 * * *" },
//   async ({ step }) => {
//     const recurringTransactions = await step.run(
//       "fetch-recurring-transactions",
//       async () => {
//         return await db.transaction.findMany({
//           where: {
//             isRecurring: true,
//             status: "COMPLETED",
//             OR: [
//               { lastProcessed: null },
//               { nextRecurringDate: { lte: new Date() } },
//             ],
//           },
//         });
//       }
//     );

//     if (recurringTransactions.length > 0) {
//       const events = recurringTransactions.map((transaction) => ({
//         name: "transaction.recurring.process",
//         data: {
//           transactionId: transaction.id,
//           userId: transaction.userId,
//         },
//       }));
//       await inngest.send(events);
//     }

//     return { triggered: recurringTransactions.length };
//   }
// );

// // 3. Monthly Report Generation
// export const generateMonthlyReports = inngest.createFunction(
//   {
//     id: "generate-monthly-reports",
//     name: "Generate Monthly Reports",
//   },
//   { cron: "0 0 1 * *" },
//   async ({ step }) => {
//     const users = await step.run("fetch-users", async () => {
//       return await db.user.findMany({
//         include: { accounts: true },
//       });
//     });

//     for (const user of users) {
//       await step.run(`generate-report-${user.id}`, async () => {
//         const lastMonth = new Date();
//         lastMonth.setMonth(lastMonth.getMonth() - 1);

//         const stats = await getMonthlyStats(user.id, lastMonth);
//         const monthName = lastMonth.toLocaleString("default", {
//           month: "long",
//         });

//         const insights = [
//           "Your highest expense category this month might need attention.",
//           "Consider setting up a budget for better financial management.",
//           "Track your recurring expenses to identify potential savings.",
//         ];

//         await sendEmail({
//           to: user.email,
//           subject: `Your Monthly Financial Report - ${monthName}`,
//           react: EmailTemplate({
//             userName: user.name,
//             type: "monthly-report",
//             data: { stats, month: monthName, insights },
//           }),
//         });
//       });
//     }

//     return { processed: users.length };
//   }
// );

// // 4. Budget Alerts
// export const checkBudgetAlerts = inngest.createFunction(
//   { id: "check-budget-alerts", name: "Check Budget Alerts" },
//   { cron: "0 */6 * * *" },
//   async ({ step }) => {
//     const budgets = await step.run("fetch-budgets", async () => {
//       return await db.budget.findMany({
//         include: {
//           user: {
//             include: {
//               accounts: {
//                 where: { isDefault: true },
//               },
//             },
//           },
//         },
//       });
//     });

//     for (const budget of budgets) {
//       const defaultAccount = budget.user.accounts[0];

//       await step.run(`check-budget-${budget.id}`, async () => {
//         // ===== DEBUG LOGS =====
//         console.log("\n=== BUDGET DEBUG ===");
//         console.log("Budget ID:", budget.id);
//         console.log("Budget Amount:", budget.amount.toString());
//         console.log("User Email:", budget.user.email);
//         console.log("User Name:", budget.user.name);
//         console.log("Default Account:", defaultAccount?.name ?? "NOT FOUND");
//         console.log("Last Alert Sent:", budget.lastAlertSent ?? "NULL");

//         if (!defaultAccount) {
//           console.log("❌ SKIPPED - No default account found");
//           return null;
//         }

//         const startDate = new Date();
//         startDate.setDate(1);
//         startDate.setHours(0, 0, 0, 0);

//         const expenses = await db.transaction.aggregate({
//           where: {
//             userId: budget.userId,
//             accountId: defaultAccount.id,
//             type: "EXPENSE",
//             date: { gte: startDate },
//           },
//           _sum: { amount: true },
//         });

//         const totalExpenses = expenses._sum.amount?.toNumber() || 0;
//         const budgetAmount = budget.amount.toNumber();
//         const percentageUsed = (totalExpenses / budgetAmount) * 100;

//         // ===== DEBUG LOGS =====
//         console.log("\n=== CALCULATIONS ===");
//         console.log("Total Expenses This Month:", totalExpenses);
//         console.log("Budget Amount:", budgetAmount);
//         console.log("Percentage Used:", percentageUsed.toFixed(1) + "%");
//         console.log("Passes 1% threshold:", percentageUsed >= 1);
//         console.log(
//           "Is New Month or No Alert Sent:",
//           !budget.lastAlertSent ||
//             isNewMonth(new Date(budget.lastAlertSent), new Date())
//         );

//         const shouldSendAlert =
//           percentageUsed >= 1 && // lowered to 1% for testing (change back to 80 later)
//           (!budget.lastAlertSent ||
//             isNewMonth(new Date(budget.lastAlertSent), new Date()));

//         if (!shouldSendAlert) {
//           console.log("❌ SKIPPED - Conditions not met");
//           return null;
//         }

//         console.log("\n=== SENDING EMAIL ===");
//         console.log("Sending to:", budget.user.email);

//         const emailResult = await sendEmail({
//           to: budget.user.email,
//           subject: `Budget Alert for ${defaultAccount.name}`,
//           react: EmailTemplate({
//             userName: budget.user.name,
//             type: "budget-alert",
//             data: {
//               percentageUsed,
//               budgetAmount: parseInt(budgetAmount).toFixed(1),
//               totalExpenses: parseInt(totalExpenses).toFixed(1),
//               accountName: defaultAccount.name,
//             },
//           }),
//         });

//         // ===== DEBUG LOGS =====
//         console.log("\n=== EMAIL RESULT ===");
//         console.log(JSON.stringify(emailResult, null, 2));

//         if (emailResult.success) {
//           console.log("✅ Email sent successfully!");
//           await db.budget.update({
//             where: { id: budget.id },
//             data: { lastAlertSent: new Date() },
//           });
//         } else {
//           console.log("❌ Email FAILED:", emailResult.error);
//         }

//         return { percentageUsed, totalExpenses, emailSent: emailResult.success };
//       });
//     }
//   }
// );

// // ===== UTILITY FUNCTIONS =====
// function isNewMonth(lastAlertDate, currentDate) {
//   return (
//     lastAlertDate.getMonth() !== currentDate.getMonth() ||
//     lastAlertDate.getFullYear() !== currentDate.getFullYear()
//   );
// }

// function isTransactionDue(transaction) {
//   if (!transaction.lastProcessed) return true;
//   const today = new Date();
//   const nextDue = new Date(transaction.nextRecurringDate);
//   return nextDue <= today;
// }

// function calculateNextRecurringDate(date, interval) {
//   const next = new Date(date);
//   switch (interval) {
//     case "DAILY":
//       next.setDate(next.getDate() + 1);
//       break;
//     case "WEEKLY":
//       next.setDate(next.getDate() + 7);
//       break;
//     case "MONTHLY":
//       next.setMonth(next.getMonth() + 1);
//       break;
//     case "YEARLY":
//       next.setFullYear(next.getFullYear() + 1);
//       break;
//   }
//   return next;
// }

// async function getMonthlyStats(userId, month) {
//   const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
//   const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

//   const transactions = await db.transaction.findMany({
//     where: {
//       userId,
//       date: { gte: startDate, lte: endDate },
//     },
//   });

//   return transactions.reduce(
//     (stats, t) => {
//       const amount = t.amount.toNumber();
//       if (t.type === "EXPENSE") {
//         stats.totalExpenses += amount;
//         stats.byCategory[t.category] =
//           (stats.byCategory[t.category] || 0) + amount;
//       } else {
//         stats.totalIncome += amount;
//       }
//       return stats;
//     },
//     {
//       totalExpenses: 0,
//       totalIncome: 0,
//       byCategory: {},
//       transactionCount: transactions.length,
//     }
//   );
// }
// import { inngest } from "./client";
// import { db } from "@/lib/prisma";
// import EmailTemplate from "@/emails/template";
// import { sendEmail } from "@/actions/send-email";

// // 1. Recurring Transaction Processing with Throttling
// export const processRecurringTransaction = inngest.createFunction(
//   {
//     id: "process-recurring-transaction",
//     name: "Process Recurring Transaction",
//     throttle: {
//       limit: 10,
//       period: "1m",
//       key: "event.data.userId",
//     },
//   },
//   { event: "transaction.recurring.process" },
//   async ({ event, step }) => {
//     if (!event?.data?.transactionId || !event?.data?.userId) {
//       console.error("Invalid event data:", event);
//       return { error: "Missing required event data" };
//     }

//     await step.run("process-transaction", async () => {
//       const transaction = await db.transaction.findUnique({
//         where: {
//           id: event.data.transactionId,
//           userId: event.data.userId,
//         },
//         include: { account: true },
//       });

//       if (!transaction || !isTransactionDue(transaction)) return;

//       await db.$transaction(async (tx) => {
//         await tx.transaction.create({
//           data: {
//             type: transaction.type,
//             amount: transaction.amount,
//             description: `${transaction.description} (Recurring)`,
//             date: new Date(),
//             category: transaction.category,
//             userId: transaction.userId,
//             accountId: transaction.accountId,
//             isRecurring: false,
//           },
//         });

//         const balanceChange =
//           transaction.type === "EXPENSE"
//             ? -transaction.amount.toNumber()
//             : transaction.amount.toNumber();

//         await tx.account.update({
//           where: { id: transaction.accountId },
//           data: { balance: { increment: balanceChange } },
//         });

//         await tx.transaction.update({
//           where: { id: transaction.id },
//           data: {
//             lastProcessed: new Date(),
//             nextRecurringDate: calculateNextRecurringDate(
//               new Date(),
//               transaction.recurringInterval
//             ),
//           },
//         });
//       });
//     });
//   }
// );

// // 2. Trigger Recurring Transactions
// export const triggerRecurringTransactions = inngest.createFunction(
//   {
//     id: "trigger-recurring-transactions",
//     name: "Trigger Recurring Transactions",
//   },
//   { cron: "0 0 * * *" },
//   async ({ step }) => {
//     const recurringTransactions = await step.run(
//       "fetch-recurring-transactions",
//       async () => {
//         return await db.transaction.findMany({
//           where: {
//             isRecurring: true,
//             status: "COMPLETED",
//             OR: [
//               { lastProcessed: null },
//               { nextRecurringDate: { lte: new Date() } },
//             ],
//           },
//         });
//       }
//     );

//     if (recurringTransactions.length > 0) {
//       const events = recurringTransactions.map((transaction) => ({
//         name: "transaction.recurring.process",
//         data: {
//           transactionId: transaction.id,
//           userId: transaction.userId,
//         },
//       }));
//       await inngest.send(events);
//     }

//     return { triggered: recurringTransactions.length };
//   }
// );

// // 3. Monthly Report Generation
// export const generateMonthlyReports = inngest.createFunction(
//   {
//     id: "generate-monthly-reports",
//     name: "Generate Monthly Reports",
//   },
//   { cron: "0 0 1 * *" },
//   async ({ step }) => {
//     const users = await step.run("fetch-users", async () => {
//       return await db.user.findMany({
//         include: { accounts: true },
//       });
//     });

//     for (const user of users) {
//       await step.run(`generate-report-${user.id}`, async () => {
//         const lastMonth = new Date();
//         lastMonth.setMonth(lastMonth.getMonth() - 1);

//         const stats = await getMonthlyStats(user.id, lastMonth);
//         const monthName = lastMonth.toLocaleString("default", {
//           month: "long",
//         });

//         const insights = [
//           "Your highest expense category this month might need attention.",
//           "Consider setting up a budget for better financial management.",
//           "Track your recurring expenses to identify potential savings.",
//         ];

//         await sendEmail({
//           to: user.email,
//           subject: `Your Monthly Financial Report - ${monthName}`,
//           react: EmailTemplate({
//             userName: user.name,
//             type: "monthly-report",
//             data: { stats, month: monthName, insights },
//           }),
//         });
//       });
//     }

//     return { processed: users.length };
//   }
// );

// // 4. Budget Alerts
// export const checkBudgetAlerts = inngest.createFunction(
//   { id: "check-budget-alerts", name: "Check Budget Alerts" },
//   { cron: "0 */6 * * *" },
//   async ({ step }) => {
//     const budgets = await step.run("fetch-budgets", async () => {
//       return await db.budget.findMany({
//         include: {
//           user: {
//             include: {
//               accounts: {
//                 where: { isDefault: true },
//               },
//             },
//           },
//         },
//       });
//     });

//     for (const budget of budgets) {
//       const defaultAccount = budget.user.accounts[0];

//       await step.run(`check-budget-${budget.id}`, async () => {
//         // ===== DEBUG LOGS =====
//         console.log("\n=== BUDGET DEBUG ===");
//         console.log("Budget ID:", budget.id);
//         console.log("Budget Amount:", budget.amount.toString());
//         console.log("User Email:", budget.user.email);
//         console.log("User Name:", budget.user.name);
//         console.log("Default Account:", defaultAccount?.name ?? "NOT FOUND");
//         console.log("Last Alert Sent:", budget.lastAlertSent ?? "NULL");

//         if (!defaultAccount) {
//           console.log("❌ SKIPPED - No default account found");
//           return null;
//         }

//         const startDate = new Date();
//         startDate.setDate(1);
//         startDate.setHours(0, 0, 0, 0);

//         const expenses = await db.transaction.aggregate({
//           where: {
//             userId: budget.userId,
//             accountId: defaultAccount.id,
//             type: "EXPENSE",
//             date: { gte: startDate },
//           },
//           _sum: { amount: true },
//         });

//         // ✅ FIXED: Use Number() instead of .toNumber()
//         const totalExpenses = Number(expenses._sum.amount) || 0;
//         const budgetAmount = Number(budget.amount);
//         const percentageUsed = (totalExpenses / budgetAmount) * 100;

//         // ===== DEBUG LOGS =====
//         console.log("\n=== CALCULATIONS ===");
//         console.log("Total Expenses This Month:", totalExpenses);
//         console.log("Budget Amount:", budgetAmount);
//         console.log("Percentage Used:", percentageUsed.toFixed(1) + "%");
//         console.log("Passes 1% threshold:", percentageUsed >= 1);
//         console.log(
//           "Is New Month or No Alert Sent:",
//           !budget.lastAlertSent ||
//             isNewMonth(new Date(budget.lastAlertSent), new Date())
//         );

//         const shouldSendAlert =
//           percentageUsed >= 1 && // 👈 Keep at 1 for testing, change back to 80 later
//           (!budget.lastAlertSent ||
//             isNewMonth(new Date(budget.lastAlertSent), new Date()));

//         if (!shouldSendAlert) {
//           console.log("❌ SKIPPED - Conditions not met");
//           return null;
//         }

//         console.log("\n=== SENDING EMAIL ===");
//         console.log("Sending to:", budget.user.email);

//         const emailResult = await sendEmail({
//           to: budget.user.email,
//           subject: `Budget Alert for ${defaultAccount.name}`,
//           react: EmailTemplate({
//             userName: budget.user.name,
//             type: "budget-alert",
//             data: {
//               percentageUsed,
//               budgetAmount: parseInt(budgetAmount).toFixed(1),
//               totalExpenses: parseInt(totalExpenses).toFixed(1),
//               accountName: defaultAccount.name,
//             },
//           }),
//         });

//         // ===== DEBUG LOGS =====
//         console.log("\n=== EMAIL RESULT ===");
//         console.log(JSON.stringify(emailResult, null, 2));

//         if (emailResult.success) {
//           console.log("✅ Email sent successfully!");
//           await db.budget.update({
//             where: { id: budget.id },
//             data: { lastAlertSent: new Date() },
//           });
//         } else {
//           console.log("❌ Email FAILED:", emailResult.error);
//         }

//         return {
//           percentageUsed,
//           totalExpenses,
//           emailSent: emailResult.success,
//         };
//       });
//     }
//   }
// );

// // ===== UTILITY FUNCTIONS =====
// function isNewMonth(lastAlertDate, currentDate) {
//   return (
//     lastAlertDate.getMonth() !== currentDate.getMonth() ||
//     lastAlertDate.getFullYear() !== currentDate.getFullYear()
//   );
// }

// function isTransactionDue(transaction) {
//   if (!transaction.lastProcessed) return true;
//   const today = new Date();
//   const nextDue = new Date(transaction.nextRecurringDate);
//   return nextDue <= today;
// }

// function calculateNextRecurringDate(date, interval) {
//   const next = new Date(date);
//   switch (interval) {
//     case "DAILY":
//       next.setDate(next.getDate() + 1);
//       break;
//     case "WEEKLY":
//       next.setDate(next.getDate() + 7);
//       break;
//     case "MONTHLY":
//       next.setMonth(next.getMonth() + 1);
//       break;
//     case "YEARLY":
//       next.setFullYear(next.getFullYear() + 1);
//       break;
//   }
//   return next;
// }

// async function getMonthlyStats(userId, month) {
//   const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
//   const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

//   const transactions = await db.transaction.findMany({
//     where: {
//       userId,
//       date: { gte: startDate, lte: endDate },
//     },
//   });

//   return transactions.reduce(
//     (stats, t) => {
//       const amount = t.amount.toNumber();
//       if (t.type === "EXPENSE") {
//         stats.totalExpenses += amount;
//         stats.byCategory[t.category] =
//           (stats.byCategory[t.category] || 0) + amount;
//       } else {
//         stats.totalIncome += amount;
//       }
//       return stats;
//     },
//     {
//       totalExpenses: 0,
//       totalIncome: 0,
//       byCategory: {},
//       transactionCount: transactions.length,
//     }
//   );
// }
import { inngest } from "./client";
import { db } from "@/lib/prisma";
import EmailTemplate from "@/emails/template";
import { sendEmail } from "@/actions/send-email";

// 1. Recurring Transaction Processing with Throttling
export const processRecurringTransaction = inngest.createFunction(
  {
    id: "process-recurring-transaction",
    name: "Process Recurring Transaction",
    throttle: {
      limit: 10,
      period: "1m",
      key: "event.data.userId",
    },
  },
  { event: "transaction.recurring.process" },
  async ({ event, step }) => {
    if (!event?.data?.transactionId || !event?.data?.userId) {
      console.error("Invalid event data:", event);
      return { error: "Missing required event data" };
    }

    await step.run("process-transaction", async () => {
      const transaction = await db.transaction.findUnique({
        where: {
          id: event.data.transactionId,
          userId: event.data.userId,
        },
        include: { account: true },
      });

      if (!transaction || !isTransactionDue(transaction)) return;

      await db.$transaction(async (tx) => {
        await tx.transaction.create({
          data: {
            type: transaction.type,
            amount: transaction.amount,
            description: `${transaction.description} (Recurring)`,
            date: new Date(),
            category: transaction.category,
            userId: transaction.userId,
            accountId: transaction.accountId,
            isRecurring: false,
          },
        });

        const balanceChange =
          transaction.type === "EXPENSE"
            ? -transaction.amount.toNumber()
            : transaction.amount.toNumber();

        await tx.account.update({
          where: { id: transaction.accountId },
          data: { balance: { increment: balanceChange } },
        });

        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            lastProcessed: new Date(),
            nextRecurringDate: calculateNextRecurringDate(
              new Date(),
              transaction.recurringInterval
            ),
          },
        });
      });
    });
  }
);

// 2. Trigger Recurring Transactions
export const triggerRecurringTransactions = inngest.createFunction(
  {
    id: "trigger-recurring-transactions",
    name: "Trigger Recurring Transactions",
  },
  { cron: "0 0 * * *" },
  async ({ step }) => {
    const recurringTransactions = await step.run(
      "fetch-recurring-transactions",
      async () => {
        return await db.transaction.findMany({
          where: {
            isRecurring: true,
            status: "COMPLETED",
            OR: [
              { lastProcessed: null },
              { nextRecurringDate: { lte: new Date() } },
            ],
          },
        });
      }
    );

    if (recurringTransactions.length > 0) {
      const events = recurringTransactions.map((transaction) => ({
        name: "transaction.recurring.process",
        data: {
          transactionId: transaction.id,
          userId: transaction.userId,
        },
      }));
      await inngest.send(events);
    }

    return { triggered: recurringTransactions.length };
  }
);

// 3. Monthly Report Generation
export const generateMonthlyReports = inngest.createFunction(
  {
    id: "generate-monthly-reports",
    name: "Generate Monthly Reports",
  },
  { cron: "0 0 1 * *" },
  async ({ step }) => {
    const users = await step.run("fetch-users", async () => {
      return await db.user.findMany({
        include: { accounts: true },
      });
    });

    for (const user of users) {
      await step.run(`generate-report-${user.id}`, async () => {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        const stats = await getMonthlyStats(user.id, lastMonth);
        const monthName = lastMonth.toLocaleString("default", {
          month: "long",
        });

        const insights = [
          "Your highest expense category this month might need attention.",
          "Consider setting up a budget for better financial management.",
          "Track your recurring expenses to identify potential savings.",
        ];

        await sendEmail({
          to: user.email,
          subject: `Your Monthly Financial Report - ${monthName}`,
          react: EmailTemplate({
            userName: user.name,
            type: "monthly-report",
            data: { stats, month: monthName, insights },
          }),
        });
      });
    }

    return { processed: users.length };
  }
);

// 4. Budget Alerts
export const checkBudgetAlerts = inngest.createFunction(
  { id: "check-budget-alerts", name: "Check Budget Alerts" },
  { cron: "0 */6 * * *" },
  async ({ step }) => {
    const budgets = await step.run("fetch-budgets", async () => {
      return await db.budget.findMany({
        include: {
          user: {
            include: {
              accounts: {
                where: { isDefault: true },
              },
            },
          },
        },
      });
    });

    for (const budget of budgets) {
      const defaultAccount = budget.user.accounts[0];
      if (!defaultAccount) continue;

      await step.run(`check-budget-${budget.id}`, async () => {
        const startDate = new Date();
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);

        const expenses = await db.transaction.aggregate({
          where: {
            userId: budget.userId,
            accountId: defaultAccount.id,
            type: "EXPENSE",
            date: { gte: startDate },
          },
          _sum: { amount: true },
        });

        const totalExpenses = Number(expenses._sum.amount) || 0;
        const budgetAmount = Number(budget.amount);
        const percentageUsed = (totalExpenses / budgetAmount) * 100;

        if (
          percentageUsed >= 80 &&
          (!budget.lastAlertSent ||
            isNewMonth(new Date(budget.lastAlertSent), new Date()))
        ) {
          await sendEmail({
            to: budget.user.email,
            subject: `Budget Alert for ${defaultAccount.name}`,
            react: EmailTemplate({
              userName: budget.user.name,
              type: "budget-alert",
              data: {
                percentageUsed,
                budgetAmount: parseInt(budgetAmount).toFixed(1),
                totalExpenses: parseInt(totalExpenses).toFixed(1),
                accountName: defaultAccount.name,
              },
            }),
          });

          await db.budget.update({
            where: { id: budget.id },
            data: { lastAlertSent: new Date() },
          });
        }
      });
    }
  }
);

// ===== UTILITY FUNCTIONS =====
function isNewMonth(lastAlertDate, currentDate) {
  return (
    lastAlertDate.getMonth() !== currentDate.getMonth() ||
    lastAlertDate.getFullYear() !== currentDate.getFullYear()
  );
}

function isTransactionDue(transaction) {
  if (!transaction.lastProcessed) return true;
  const today = new Date();
  const nextDue = new Date(transaction.nextRecurringDate);
  return nextDue <= today;
}

function calculateNextRecurringDate(date, interval) {
  const next = new Date(date);
  switch (interval) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

async function getMonthlyStats(userId, month) {
  const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
  const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const transactions = await db.transaction.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
  });

  return transactions.reduce(
    (stats, t) => {
      const amount = t.amount.toNumber();
      if (t.type === "EXPENSE") {
        stats.totalExpenses += amount;
        stats.byCategory[t.category] =
          (stats.byCategory[t.category] || 0) + amount;
      } else {
        stats.totalIncome += amount;
      }
      return stats;
    },
    {
      totalExpenses: 0,
      totalIncome: 0,
      byCategory: {},
      transactionCount: transactions.length,
    }
  );
}