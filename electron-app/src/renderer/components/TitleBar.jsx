// src/renderer/components/TitleBar.jsx
import appIcon from '../assets/app-icon.png'; // Adjust the path as necessary

export default function TitleBar() {
  return (
    <div
      className="fixed top-0 left-0 w-full h-8 z-50 flex justify-between items-center px-4 pr-0 bg-[#1B1340] text-white font-titla select-none overflow-hidden"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="font-medium text-sm flex items-center"> 
        <img src={appIcon} alt="app-icon" className="inline-block w-5 h-5 bg-center mr-2"/> 
        RST - Advance Website Seo Tool
      </div>
      {/* <div className="flex gap-0" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={() => window.electronAPI.minimize()}
          className="w-12 h-8 hover:bg-[#372580] rounded"
        >
          –
        </button>
        <button
          onClick={() => window.electronAPI.maximize()}
          className="w-12 h-8 hover:bg-[#372580] rounded"
        >
          ☐
        </button>
        <button
          onClick={() => window.electronAPI.close()}
          className="w-12 h-8 hover:bg-red-600 rounded"
        >
          ✕
        </button>
      </div> */}
    </div>
  );
}
