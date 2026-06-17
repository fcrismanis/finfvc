import {
  Utensils, Repeat, Home, Car, HeartPulse, GraduationCap, Briefcase, Smile,
  PawPrint, Shield, ArrowLeftRight, Wallet, TrendingUp, Circle, ShoppingBag,
  RefreshCw, Coins, Gift, BookOpen, Receipt, Sparkles, Ticket, Users, Wrench,
  Plane, MoreHorizontal, PiggyBank, HandHeart, AlertTriangle, Star, Dumbbell,
  Music, Minus,
} from 'lucide-react'

export type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>

export const ICON_MAP: Record<string, IconComponent> = {
  'utensils': Utensils,
  'repeat': Repeat,
  'home': Home,
  'car': Car,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  'briefcase': Briefcase,
  'smile': Smile,
  'paw-print': PawPrint,
  'shield': Shield,
  'arrow-left-right': ArrowLeftRight,
  'wallet': Wallet,
  'trending-up': TrendingUp,
  'shopping-bag': ShoppingBag,
  'refresh-cw': RefreshCw,
  'coins': Coins,
  'gift': Gift,
  'book-open': BookOpen,
  'receipt': Receipt,
  'sparkles': Sparkles,
  'ticket': Ticket,
  'users': Users,
  'wrench': Wrench,
  'plane': Plane,
  'more-horizontal': MoreHorizontal,
  'piggy-bank': PiggyBank,
  'hand-heart': HandHeart,
  'alert-triangle': AlertTriangle,
  'star': Star,
  'dumbbell': Dumbbell,
  'music': Music,
  'circle': Circle,
  'minus': Minus,
}

export const ICON_ENTRIES = Object.entries(ICON_MAP)

