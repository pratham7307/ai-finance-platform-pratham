// /** @type {import('next').NextConfig} */
// const nextConfig = {
//    reactStrictMode: false,
//   reactCompiler: false,
//   images: {
//     remotePatterns: [
//       {
//         protocol: 'https',
//         hostname: 'randomuser.me',
//         port: '',
//         pathname: '/api/portraits/**',
//       },
//     ],
//   },
//   experimental:{
//     serveraction:{
//       bodySizelimit:"5mb",
//     },
//   },
// };

// export default nextConfig;
/** @type {import('next').NextConfig} */
const nextConfig = { // ✅ Add this to fix double creation
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'randomuser.me',
        port: '',
        pathname: '/api/portraits/**',
      },
    ],
  },
  experimental: {
    serverActions: {          // ✅ Fixed typo: serveraction → serverActions
      bodySizeLimit: "5mb",  // ✅ Fixed typo: bodySizelimit → bodySizeLimit
    },
  },
};

export default nextConfig;