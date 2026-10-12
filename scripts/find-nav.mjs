import fs from 'fs';

const list = JSON.parse(fs.readFileSync('docs/extracted_strings.json', 'utf8'));

// Filter for intro / onboarding content
const intros = list.filter(s => 
  s.includes('Disappears') || 
  s.includes('Smart Expense') || 
  s.includes('Achieve') || 
  s.includes('Financial') ||
  s.includes('categor') ||
  s.includes('bills pile up') ||
  s.includes('suit') ||
  s.includes('streak')
);

console.log('Intro related strings:', intros);

// Let's find strings related to Main App navigation (tabs / bottom bar)
const nav = list.filter(s => 
  s === 'Home' || 
  s === 'Transactions' || 
  s === 'Wallets' || 
  s === 'Analytics' || 
  s === 'Profile' || 
  s === 'Ask Rolly' || 
  s === 'Records' || 
  s === 'Settings' ||
  s === 'Budget' ||
  s === 'Debts' ||
  s === 'Savings'
);
console.log('Nav strings:', nav);
