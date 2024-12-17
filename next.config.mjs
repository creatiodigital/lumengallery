/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.svg$/,
      use: [
        {
          loader: '@svgr/webpack',
          options: {
            svgo: true,
            svgoConfig: {
              plugins: [
                {
                  name: 'preset-default',
                  params: {
                    overrides: {
                      removeViewBox: false, // Prevent removing viewBox for responsive SVGs
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    })
    return config
  },
}

export default nextConfig
