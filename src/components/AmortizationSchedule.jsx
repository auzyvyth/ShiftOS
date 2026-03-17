
import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const AmortizationSchedule = ({ loanAmount, interestRate, years }) => {
  const { t } = useTranslation();
  const months = years * 12;
  
  if (months <= 0 || loanAmount <= 0) return null;

  // Using Malaysian Flat Rate Calculation
  const totalInterest = loanAmount * (interestRate / 100) * years;
  const monthlyInterest = totalInterest / months;
  const monthlyPrincipal = loanAmount / months;
  const monthlyPayment = monthlyPrincipal + monthlyInterest;

  const generateRows = () => {
    const rows = [];
    let balance = loanAmount + totalInterest;

    for (let i = 1; i <= months; i++) {
      balance -= monthlyPayment;
      // Prevent negative very small decimals
      if (balance < 0.01) balance = 0;

      rows.push({
        month: i,
        payment: monthlyPayment,
        principal: monthlyPrincipal,
        interest: monthlyInterest,
        balance: balance
      });
    }
    return rows;
  };

  const allRows = generateRows();
  
  // Get first 3 and last 3 months
  const displayRows = [];
  if (allRows.length <= 6) {
    displayRows.push(...allRows);
  } else {
    displayRows.push(...allRows.slice(0, 3));
    displayRows.push({ isSeparator: true });
    displayRows.push(...allRows.slice(allRows.length - 3));
  }

  return (
    <motion.div 
      className="mt-8 bg-white rounded-xl shadow-lg p-6 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-xl font-bold text-gray-900 mb-4">{t('calculator.schedule.title')}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-200">
              <th className="p-3 text-sm font-semibold text-gray-700">{t('calculator.schedule.month')}</th>
              <th className="p-3 text-sm font-semibold text-gray-700">{t('calculator.schedule.payment')}</th>
              <th className="p-3 text-sm font-semibold text-gray-700">{t('calculator.schedule.principal')}</th>
              <th className="p-3 text-sm font-semibold text-gray-700">{t('calculator.schedule.interest')}</th>
              <th className="p-3 text-sm font-semibold text-gray-700">{t('calculator.schedule.balance')}</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, index) => {
              if (row.isSeparator) {
                return (
                  <tr key={`sep-${index}`} className="border-b border-gray-100">
                    <td colSpan="5" className="p-3 text-center text-gray-400 font-bold tracking-widest">
                      . . .
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={row.month} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="p-3 text-sm text-gray-900">{row.month}</td>
                  <td className="p-3 text-sm text-gray-900 font-medium">RM {row.payment.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  <td className="p-3 text-sm text-gray-600">RM {row.principal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  <td className="p-3 text-sm text-gray-600">RM {row.interest.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  <td className="p-3 text-sm text-gray-900 font-semibold">RM {row.balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default AmortizationSchedule;
