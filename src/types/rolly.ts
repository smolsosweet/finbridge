export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  title: string;
  category: string;
  categoryIcon?: string;
  categoryEmoji: string;
  date: string;
  walletName: string;
  isExpense: boolean;
  user?: string;
}

export interface Wallet {
  id: string;
  name: string;
  balance: number;
  currency: string;
  icon: string;
  color?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  transaction?: {
    type: 'Expense' | 'Income';
    category: string;
    item: string;
    amount: number;
    currency: string;
    date: string;
    emoji: string;
  };
  budgetRemaining?: {
    remaining: number;
    total: number;
    category: string;
    currency: string;
  };
}

export interface CategoryItem {
  id: string;
  name: string;
  emoji: string;
  iconPath?: string;
  color: string;
  allocatedBudget: number;
  spent: number;
}
