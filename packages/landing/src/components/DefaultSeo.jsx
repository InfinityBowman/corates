import { Meta } from '@solidjs/meta';
import { config } from '~/lib/config';

export default function DefaultSeo() {
  const imageUrl = `${config.appUrl}/product.webp`;

  return (
    <>
      <Meta property='og:type' content='website' />
      <Meta property='og:site_name' content='CoRATES' />
      <Meta property='og:image' content={imageUrl} />
      <Meta property='og:image:alt' content='CoRATES product screenshot' />
      <Meta property='og:image:width' content='2524' />
      <Meta property='og:image:height' content='1770' />

      <Meta name='twitter:card' content='summary_large_image' />
      <Meta name='twitter:image' content={imageUrl} />

      <Meta name='robots' content='index,follow,max-image-preview:large' />
    </>
  );
}
