"use client";

import Image from "next/image";
import { FinBridgeMascot } from "@/components/FinBridgeMascot";
import { useState } from "react";
import { ArrowRight, Camera, ChevronDown, Menu, MessageCircle, PieChart, Star, X } from "lucide-react";

interface LandingPageViProps {
  onGoToWeb: () => void;
}

const featureCards = [
  ["Giao Diện Chat Tương Tác", "Nói chuyện với tiền của bạn. Ghi chi tiêu qua hội thoại và nhận phản hồi hữu ích ngay lập tức.", MessageCircle],
  ["Quét Hóa Đơn bằng AI", "Chụp ảnh và AI trích xuất tên cửa hàng, mặt hàng, thuế và tổng tiền chỉ trong vài giây.", Camera],
  ["Phân Tích AI Sâu Sắc", "Xu hướng cá nhân hóa, phát hiện mẫu chi tiêu và đề xuất tiết kiệm từ AI.", PieChart],
] as const;

const faqs = [
  ["Rolly có miễn phí không?", "Có! Các tính năng cơ bản hoàn toàn miễn phí; các tính năng Premium có thể mở khóa khi nâng cấp."],
  ["Tôi có thể tải lên hóa đơn không?", "Có. AI đọc từng mục, tổng cộng và thuế, sau đó tự động phân loại."],
  ["Dữ liệu của tôi có an toàn không?", "Rolly sử dụng mã hóa cấp ngân hàng và không bán thông tin cá nhân."],
];

export function LandingPageVi({ onGoToWeb }: LandingPageViProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [faq, setFaq] = useState(0);
  return <div className="min-h-screen bg-[#fafaff] text-[#1d1d23]">
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-10">
        <a href="#top" className="flex items-center gap-2 text-2xl font-bold text-[#0764c7] [font-family:Georgia,serif]"><Image src="/finbridge/images/Logo-transparent-1024x1024.png" alt="Rolly" width={34} height={34} className="size-9 object-contain" />Rolly</a>
        <div className="hidden gap-8 text-sm font-medium text-slate-700 md:flex"><a href="#features">Tính năng</a><a href="#reviews">Bài viết</a><span>Hướng dẫn⌄</span><span>So sánh⌄</span><a href="#contact">Liên hệ</a></div>
        <div className="flex items-center gap-3"><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs">EN / <b className="text-[#0764c7]">VI</b></span><button type="button" onClick={onGoToWeb} className="hidden rounded-full bg-[#0764c7] px-4 py-2 text-xs font-bold text-white sm:block">Dùng trên web</button><button type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Mở menu" className="p-2 md:hidden">{menuOpen ? <X /> : <Menu />}</button></div>
      </nav>
      {menuOpen && <div className="flex flex-col gap-3 border-t bg-white px-5 py-4 text-sm md:hidden"><a href="#features">Tính năng</a><a href="#reviews">Bài viết</a><button type="button" onClick={onGoToWeb} className="w-fit rounded-full bg-[#0764c7] px-4 py-2 font-bold text-white">Dùng trên web</button></div>}
    </header>
    <main id="top">
      <section className="overflow-hidden bg-[radial-gradient(circle_at_76%_68%,#e7faf2,transparent_23%),#fafaff] px-5 py-20 lg:py-28"><div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
        <div><div className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-bold text-slate-600 shadow-sm"><span className="flex text-[#98e8c3]">{Array.from({ length: 5 }, (_, i) => <Star key={i} className="size-4 fill-current" />)}</span>ĐÁNH GIÁ 4.8/5 BỞI 10.000+ NGƯỜI DÙNG</div><h1 className="mt-7 text-5xl leading-[.98] sm:text-6xl lg:text-7xl [font-family:Georgia,serif]">Theo Dõi Chi Tiêu<br /><em className="text-[#0764c7]">cùng AI</em></h1><p className="mt-8 max-w-xl text-lg leading-relaxed text-slate-600">Ghi chi tiêu qua tin nhắn, giọng nói hoặc ảnh. Rolly theo dõi, phân loại và đưa ra nhận xét — tự động.</p><div className="mt-8 flex flex-wrap gap-3"><a href="https://apps.apple.com/us/app/rolly-ai-budget-money-tracker/id6636525257" className="rounded-full bg-[#0764c7] px-7 py-3.5 text-sm font-bold text-white">Tải về cho iOS</a><a href="https://play.google.com/store/apps/details?id=com.jc.rollymoneytracker" className="rounded-full bg-[#dce8fa] px-7 py-3.5 text-sm font-bold">Tải về cho Android</a><button type="button" onClick={onGoToWeb} className="flex items-center gap-1 px-3 text-sm font-semibold text-[#0764c7]">Hoặc dùng trên web <ArrowRight className="size-4" /></button></div></div>
        <div className="relative mx-auto flex min-h-[450px] items-center justify-center"><div className="absolute size-80 rounded-full bg-[#e8faf4] blur-2xl" /><div className="relative w-[245px] rounded-[3rem] border-[5px] border-slate-600 bg-slate-950 p-1.5 shadow-2xl"><div className="absolute left-1/2 top-0 z-10 h-7 w-28 -translate-x-1/2 rounded-b-2xl bg-slate-950" /><div className="aspect-[9/18.7] rounded-[2.55rem] bg-[#fffdf8] p-4 pt-12 text-[10px] text-slate-600"><FinBridgeMascot size={68} label="Finn, FinBridge" className="mx-auto" /><p className="mt-4 text-center">Conversation last 48 hours</p><p className="mt-5 rounded-xl border bg-white p-2">Hello! 👋 Let&apos;s start adding your transaction here!</p><p className="ml-auto mt-3 w-fit rounded-xl bg-[#dff7f3] px-2 py-1">dinner 18</p><p className="mt-3 rounded-xl border bg-white p-2">Dinner again? Are you running away from home? 😄</p></div></div></div>
      </div></section>
      <section className="bg-[#f1f7f5] px-5 py-16"><div className="mx-auto grid max-w-5xl items-center gap-8 sm:grid-cols-[160px_1fr]"><FinBridgeMascot size={150} label="Finn, FinBridge" className="mx-auto" /><div><h2 className="text-4xl [font-family:Georgia,serif]">Rolly là gì?</h2><p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">Rolly là ứng dụng tài chính dùng AI: bạn chỉ cần nhắn một câu — như “bún bò 50k” — hoặc nói, hoặc chụp hóa đơn, AI sẽ tự ghi và phân loại giúp bạn.</p><div className="mt-6 flex flex-wrap gap-9 text-sm text-slate-500"><p><b className="block text-xl text-[#0764c7]">4.8★</b>hơn 10.000 người dùng</p><p><b className="block text-xl text-[#0764c7]">98%</b>độ chính xác AI</p><p><b className="block text-xl text-[#0764c7]">Miễn phí</b>iOS · Android · Web</p></div></div></div></section>
      <section id="features" className="px-5 py-24"><div className="mx-auto max-w-7xl"><div className="mx-auto mb-14 max-w-3xl text-center"><h2 className="text-4xl sm:text-5xl [font-family:Georgia,serif]">Nói Lời Tạm Biệt với<br /><em className="text-[#0764c7]">Quản Lý Tài Chính Nhàm Chán</em></h2><p className="mt-5 text-slate-600">Rolly biến việc theo dõi tiền thành cuộc trò chuyện trực quan và thông minh.</p></div><div className="grid gap-6 md:grid-cols-3">{featureCards.map(([title, text, Icon]) => <article key={title} className="rounded-[2rem] border border-slate-100 bg-[#f8faf9] p-7 shadow-sm"><Icon className="size-7 text-[#0764c7]" /><h3 className="mt-5 text-xl font-bold">{title}</h3><p className="mt-3 text-sm leading-relaxed text-slate-600">{text}</p><div className="mt-6 rounded-2xl bg-white p-4 text-xs shadow-sm">AI ghi nhận, phân loại và theo dõi chi tiêu của bạn chỉ trong vài giây.</div></article>)}</div></div></section>
      <section id="reviews" className="bg-[#072535] px-5 py-24 text-white"><div className="mx-auto max-w-7xl"><p className="text-xs font-bold tracking-[.18em] text-[#98e8c3]">TÍNH NĂNG</p><h2 className="mt-3 max-w-2xl text-4xl sm:text-5xl [font-family:Georgia,serif]">Tất cả những gì bạn cần, không hơn không kém.</h2><div className="mt-12 grid gap-px rounded-3xl bg-white/10 sm:grid-cols-2 lg:grid-cols-4">{["Nhập bằng giọng nói", "Tự động phân loại", "Nhiều ví tiền", "Ngân sách chung", "Biểu đồ chi tiêu", "Nhận xét từ AI", "Lịch giao dịch", "Tự động hóa"].map((title, index) => <div key={title} className="bg-[#072535] p-6"><b className="text-[#98e8c3]">0{index + 1}</b><h3 className="mt-5 text-xl font-bold">{title}</h3><p className="mt-3 text-sm text-slate-300">Công cụ rõ ràng giúp bạn hiểu tiền của mình đi đâu.</p></div>)}</div></div></section>
      <section className="bg-[#f7f8fc] px-5 py-24"><div className="mx-auto max-w-3xl"><p className="text-center text-xs font-bold tracking-[.18em] text-[#0764c7]">CÂU HỎI THƯỜNG GẶP</p><h2 className="mt-3 text-center text-4xl [font-family:Georgia,serif]">Câu hỏi phổ biến</h2><div className="mt-10 divide-y rounded-3xl border bg-white px-6">{faqs.map(([question, answer], index) => <div key={question}><button type="button" onClick={() => setFaq(faq === index ? -1 : index)} className="flex w-full items-center justify-between py-5 text-left font-semibold">{question}<ChevronDown className={faq === index ? "rotate-180" : ""} /></button>{faq === index && <p className="pb-5 text-sm leading-relaxed text-slate-600">{answer}</p>}</div>)}</div></div></section>
      <section id="contact" className="bg-[#0764c7] px-5 py-24 text-center text-white"><h2 className="text-4xl sm:text-5xl [font-family:Georgia,serif]">Sẵn sàng kiểm soát<br />tài chính của bạn?</h2><p className="mx-auto mt-5 max-w-xl text-blue-100">Tham gia cùng 10.000+ người dùng quản lý ngân sách theo cách dễ dàng.</p><button type="button" onClick={onGoToWeb} className="mt-8 rounded-full bg-white px-7 py-3.5 font-bold text-[#0764c7]">Dùng trên web →</button></section>
    </main>
    <footer className="bg-[#061e2b] px-5 py-12 text-slate-300"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5"><span className="flex items-center gap-2 text-2xl font-bold text-white"><Image src="/finbridge/images/Logo-transparent-1024x1024.png" alt="" width={28} height={28} />Rolly</span><span className="text-sm">Giúp bạn tổ chức, theo dõi và đạt được mục tiêu tài chính.</span><button type="button" onClick={onGoToWeb} className="text-sm">Ứng dụng Web</button></div></footer>
  </div>;
}
