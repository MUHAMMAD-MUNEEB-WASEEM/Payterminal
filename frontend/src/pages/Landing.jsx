import { Link } from 'react-router-dom';
import { FileText, Shield, Zap, CheckCircle } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">US</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Invoicing</h1>
              <p className="text-xs text-gray-500">Payment Terminal</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link
              to="/login?type=user"
              className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              User Login
            </Link>
            <Link
              to="/login?type=admin"
              className="px-5 py-2 border border-purple-600 bg-purple-50 rounded-lg text-sm font-medium text-purple-700 hover:bg-purple-100 transition-colors"
            >
              Admin Login
            </Link>
            <Link
              to="/signup"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Professional Invoice & Payment System
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Create, manage, and process invoices with secure payment processing. Built for small and startup businesses.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/signup"
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-lg font-semibold text-white transition-colors shadow-lg"
            >
              Get Started Free
            </Link>
            <Link
              to="/login?type=user"
              className="px-8 py-4 border-2 border-gray-300 hover:border-gray-400 rounded-lg text-lg font-semibold text-gray-700 transition-colors"
            >
              User Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <FileText className="text-blue-600" size={28} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Easy Invoice Creation</h3>
            <p className="text-gray-600">
              Generate professional invoices in seconds with customizable line items and automatic calculations.
            </p>
          </div>

          <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
            <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-4">
              <Shield className="text-green-600" size={28} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Secure Payments</h3>
            <p className="text-gray-600">
              Accept credit card payments with bank-level security and PCI compliance through N-Genius gateway.
            </p>
          </div>

          <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
              <Zap className="text-purple-600" size={28} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Instant Processing</h3>
            <p className="text-gray-600">
              Real-time payment processing with instant status updates and automated notifications.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { step: '1', title: 'Sign Up', desc: 'Create your account and wait for admin approval' },
            { step: '2', title: 'Create Invoice', desc: 'Generate invoices with your brand details' },
            { step: '3', title: 'Share Link', desc: 'Send payment link to your customers' },
            { step: '4', title: 'Get Paid', desc: 'Receive secure payments instantly' },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                {item.step}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-600 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to streamline your invoicing?</h2>
          <p className="text-xl text-blue-100 mb-8">Join hundreds of businesses using Invoicing Payment Terminal</p>
          <Link
            to="/signup"
            className="inline-block px-8 py-4 bg-white hover:bg-gray-100 rounded-lg text-lg font-semibold text-blue-600 transition-colors"
          >
            Create Free Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm">© 2026 Invoicing Payment Terminal. All rights reserved.</p>
          <p className="text-xs mt-2">Secure payment processing powered by N-Genius</p>
        </div>
      </footer>
    </div>
  );
}
