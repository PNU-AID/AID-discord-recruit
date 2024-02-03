import axios from "axios";
import * as cheerio from "cheerio";

import { HomepageList } from "../type/json";
import { ContentType } from "../type/content";
import {
  extractPostIdInId,
  getHomepageList,
  isNotRelatedToAi,
  isRelatedToAi,
  removeExtraSpaces,
  updateLatestPostIndex,
} from "./util";
import { convertDataWithTemplate, sendDiscordNotification } from "./discord";

export async function crawlWebsite() {
  // 크롤링할 대상 사이트 리스트를 가져온다.
  const { homepageList, latestPostIndex } = getHomepageList();
  // console.log(homepageList);

  const contentData: ContentType[] = [];

  // 사이트별로 크롤링 수행 후, 필요한 데이터만을 추출한다.
  for (const homepageItem of homepageList.data) {
    let newLatestPostIndex = latestPostIndex;
    try {
      console.log("===", homepageItem.url, "작업 중... ===");
      const response = await axios.get(homepageItem.url);
      const $ = cheerio.load(response.data);
      const links = $(".fusion-image-wrapper").find("a");

      let count = 0;
      links.each(function () {
        // 파싱할 아이템의 수를 10개로 제한한다.
        // TODO: 비동기 iterate 작업이 너무 빨라서 10개를 조금 넘어서 멈춘다. 고치면 좋을 듯.
        if (count > 50) {
          return;
        }
        count += 1;
        const contentUrl = $(this).attr("href");
        const contentLabel = $(this).attr("aria-label");
        if (!contentUrl) {
          return;
        }
        const contentId = extractPostIdInId(contentUrl);
        console.log(contentId);
        if (contentId <= latestPostIndex) {
          return;
        } else if (newLatestPostIndex < contentId) {
          newLatestPostIndex = contentId;
        }

        if (
          isRelatedToAi(contentLabel || "") &&
          !isNotRelatedToAi(contentLabel || "")
        ) {
          contentData.push({
            contentUrl: contentUrl || "https://www.naver.com/",
            contentLabel: contentLabel || "네이버(기본값)",
          });
        }
      });

      console.log(contentData);
    } catch (error) {
      console.error(
        "다음 페이지를 읽다가 에러가 발생하였습니다.",
        homepageItem.url
      );
    }

    // 본문이 AI와 관련되었는지 필터링하는 로직.
    // const contentDataRelatedToAi: ContentType[] = [];

    // for (const contentItem of contentData) {
    //   const response = await axios.get(contentItem.contentUrl);
    //   const $ = cheerio.load(response.data);
    //   const text = removeExtraSpaces($(".fusion-content-tb").text());
    //   if (isRelatedToAi(text)) {
    //     contentDataRelatedToAi.push(contentItem);
    //   }
    // }

    // // 데이터에 템플릿을 적용 이후, 디코에 전송
    // if (contentDataRelatedToAi.length > 0) {
    //   const contentWithTemplate = convertDataWithTemplate(
    //     contentDataRelatedToAi
    //   );
    //   await sendDiscordNotification(contentWithTemplate);
    //   updateLatestPostIndex(newLatestPostIndex);
    // }

    // 데이터에 템플릿을 적용 이후, 디코에 전송
    if (contentData.length > 0) {
      const contentWithTemplate = convertDataWithTemplate(contentData);
      await sendDiscordNotification(contentWithTemplate);
      updateLatestPostIndex(newLatestPostIndex);
    }

    console.log("===", homepageItem.url, "작업 종료! ===");
  }
}
