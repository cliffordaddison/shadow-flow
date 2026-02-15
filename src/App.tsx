import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { UploadCourse } from '@/pages/UploadCourse';
import { ListenRepeat } from '@/pages/ListenRepeat';
import { SettingsPage } from '@/pages/SettingsPage';
import { Speaking } from '@/pages/Speaking';
import { Writing } from '@/pages/Writing';
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/listen" replace />} />
          <Route path="upload" element={<UploadCourse />} />
          <Route path="listen" element={<ListenRepeat />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="speaking" element={<Speaking />} />
          <Route path="writing" element={<Writing />} />
          <Route path="*" element={<Navigate to="/listen" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
