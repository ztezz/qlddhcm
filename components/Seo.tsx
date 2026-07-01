
import React, { useEffect } from 'react';

interface SeoProps {
    title: string;
    description?: string;
    keywords?: string;
    systemSettings?: Record<string, string>;
}

const Seo: React.FC<SeoProps> = ({ title, description, keywords, systemSettings }) => {
    useEffect(() => {
        // Tên hệ thống / Suffix tiêu đề
        const siteName = (systemSettings?.system_name || "GeoMaster").trim();
        const seoTitleSuffix = (systemSettings?.seo_title || siteName).trim();
        
        // Cập nhật Title
        let finalTitle = title;
        if (seoTitleSuffix && seoTitleSuffix !== title) {
            finalTitle = `${title} | ${seoTitleSuffix}`;
        }

        // Loại bỏ các khoảng trắng thừa và dấu gạch đứng bị lặp lại hoặc dư thừa
        finalTitle = finalTitle
            .replace(/\|+/g, '|')        // Thay thế các dấu || liên tiếp bằng một dấu |
            .replace(/\s*\|\s*/g, ' | ')  // Chuẩn hóa khoảng trắng quanh dấu |
            .trim()
            .replace(/^\|\s*/, '')        // Loại bỏ dấu | ở đầu
            .replace(/\s*\|$/, '');       // Loại bỏ dấu | ở cuối

        document.title = finalTitle;

        // Cập nhật Meta Description
        const finalDesc = description || systemSettings?.seo_description || "Hệ thống WebGIS GeoMaster - Tra cứu quy hoạch và quản lý đất đai chuyên nghiệp.";
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', "description");
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', finalDesc);

        // Cập nhật Keywords
        const finalKeywords = keywords || systemSettings?.seo_keywords || "webgis, quy hoạch, giá đất, postgis, bản đồ số";
        let metaKeys = document.querySelector('meta[name="keywords"]');
        if (!metaKeys) {
            metaKeys = document.createElement('meta');
            metaKeys.setAttribute('name', "keywords");
            document.head.appendChild(metaKeys);
        }
        metaKeys.setAttribute('content', finalKeywords);

        // Cập nhật Open Graph (Mạng xã hội)
        let ogTitle = document.querySelector('meta[property="og:title"]');
        if (!ogTitle) { ogTitle = document.createElement('meta'); ogTitle.setAttribute('property', "og:title"); document.head.appendChild(ogTitle); }
        ogTitle.setAttribute('content', document.title);
        
        let ogDesc = document.querySelector('meta[property="og:description"]');
        if (!ogDesc) { ogDesc = document.createElement('meta'); ogDesc.setAttribute('property', "og:description"); document.head.appendChild(ogDesc); }
        ogDesc.setAttribute('content', finalDesc);
        
        if (systemSettings?.seo_og_image) {
            let ogImg = document.querySelector('meta[property="og:image"]');
            if (!ogImg) { ogImg = document.createElement('meta'); ogImg.setAttribute('property', "og:image"); document.head.appendChild(ogImg); }
            ogImg.setAttribute('content', systemSettings.seo_og_image);
        }

        // Cập nhật Favicon động
        if (systemSettings?.site_favicon) {
            let favicon = document.getElementById('favicon') as HTMLLinkElement;
            if (!favicon) {
                favicon = document.createElement('link');
                favicon.id = 'favicon';
                favicon.rel = 'icon';
                document.head.appendChild(favicon);
            }
            favicon.href = systemSettings.site_favicon;
        }

    }, [title, description, keywords, systemSettings]);

    return null;
};

export default Seo;
