// components/BudgetProgress.jsx
import React from "react";

export default function BudgetProgress({ initialBudget, currentExpenses }) {
  const percentage = initialBudget
    ? Math.min((currentExpenses / initialBudget) * 100, 100)
    : 0;

  return (
    <div>
      <p>Budget: {initialBudget}</p>
      <p>Expenses: {currentExpenses}</p>
      <div className="w-full bg-gray-200 rounded-full h-4 mt-2">
        <div
          className="bg-green-500 h-4 rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p>{percentage.toFixed(2)}% used</p>
    </div>
  );
}
