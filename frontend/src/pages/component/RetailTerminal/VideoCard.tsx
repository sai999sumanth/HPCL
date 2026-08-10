import React from 'react';

const VideoCard = ({ video, onVideoClick }) => {
  return (
    <div className="bg-white rounded-lg border border-blue-300 hover:shadow-lg transition-all duration-200">
      <div className="relative">
        {/* Video Container */}
        <div 
          className="relative aspect-video bg-gray-100 rounded-t-lg cursor-pointer" 
          onClick={() => onVideoClick(video.VideoUrl)}
        >
          <div className="relative aspect-video bg-gray-100 rounded-t-lg">
            <video 
              className="w-full h-full object-cover rounded-t-lg"
              src={video.VideoUrl}
              controls
            >
              Your browser does not support the video tag.
            </video>
            
            {/* Timestamp Badge */}
            <div className="absolute top-2 right-2 bg-black/75 text-white text-xs px-2 py-1 rounded">
              {video.timestamp}
            </div>
          </div>
        </div>

        {/* Card Content */}
        <div className="p-2 pb-0">
          {/* Title */}
          <h3 className="font-semibold mb-2 text-sm text-[#349add]">
            {video.title}
          </h3>

          {/* Recognition Time */}
          <div className="text-sm text-gray-600 mb-2">
            {video.recognizedTime}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCard;