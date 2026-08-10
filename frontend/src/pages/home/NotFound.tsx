import React from 'react';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/@/components/ui/button';

const NotFoundPage = () => {
  const goBack = () => {
    window.history.back();
  };

  const goHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl text-center space-y-8">
        {/* Animated 404 Text */}
        <div className="relative">
          <h1 className="text-9xl font-bold text-gray-200 animate-pulse">404</h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
              404
            </div>
          </div>
        </div>

        {/* Animated Message */}
        <div className="space-y-4 relative">
          <h2 className="text-3xl font-semibold text-gray-800">
            Oops! Page Not Found
          </h2>
          <p className="text-gray-600 max-w-lg mx-auto">
            We're sorry, The page you're looking for is not here.
          </p>
        </div>

        {/* Animated Decorative Elements */}
        <div className="relative h-32">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="grid grid-cols-3 gap-4 opacity-10">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-gray-400"
                  style={{
                    animation: `float 3s ease-in-out infinite`,
                    animationDelay: `${i * 0.2}s`
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button
            onClick={goHome}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-2 rounded-full transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Button>
          <Button
            onClick={goBack}
            variant="outline"
            className="border-2 border-gray-300 hover:border-gray-400 px-6 py-2 rounded-full transition-all duration-300 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
        </div>

        {/* Footer */}
        {/* <div className="text-sm text-gray-500 mt-8">
          Lost? Need help? <a href="/contact" className="text-blue-600 hover:text-blue-700 underline">Contact our support team</a>
        </div> */}
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
      `}</style>
    </div>
  );
};

export default NotFoundPage;