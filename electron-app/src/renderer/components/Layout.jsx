import React, { useState } from 'react';
import Sidebar from './SideBar';
import Topbar from './TopBar';
import TitleBar from './TitleBar';

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="flex flex-col h-screen w-screen bg-white dark:bg-[#251f47] text-black dark:text-white font-caldina overflow-hidden">
      {/* Fixed TitleBar 
      <div className="flex-shrink-0 z-40">
        <TitleBar />
      </div>
      {/*  */}
      <div className="flex flex-1 min-h-0">
        {/* Fixed Sidebar */}
        <div className="flex-shrink-0 z-30">
          <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        </div>
        {/* Main area with Topbar fixed and content scrollable */}
        <div
          className={`flex flex-col flex-1 min-h-0 transition-all duration-300 ${
            collapsed ? 'ml-[80px]' : 'ml-[260px]'
          }`}
        >
          {/* Fixed Topbar */}
          <div className="flex-shrink-0 z-20">
            <Topbar collapsed={collapsed} />
          </div>
          {/* Scrollable main content */}
          <main className="flex-1 min-h-0 mt-24 overflow-y-auto p-6 bg-[#f7f5ff] dark:bg-[#333762] rounded-tl-xl transition-colors duration-300 main-scrollable">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
