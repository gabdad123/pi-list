#include "ebu/list/sdp/media_description.h"

using namespace ebu_list;
using namespace std;

string media::to_string(media_type media_type)
{
    switch(media_type)
    {
    case media_type::VIDEO: return "video";
    case media_type::AUDIO: return "audio";
    case media_type::ANCILLARY_DATA: return "ancillary_data";
    case media_type::TTML: return "ttml";
    default: assert(media_type == media_type::UNKNOWN); return "unknown";
    }
}

media::media_type media::from_string(std::string_view media)
{
    if(media == "video")
        return media_type::VIDEO;
    else if(media == "audio")
        return media_type::AUDIO;
    else if(media == "ancillary_data")
        return media_type::ANCILLARY_DATA;
    else if(media == "ttml")
        return media_type::TTML;
    else
        return media_type::UNKNOWN;
}

string media::full_media_to_string(full_media_type full_media_type)
{
    switch(full_media_type)
    {
    case full_media_type::RAW: return "video/raw";
    case full_media_type::JXSV: return "video/jxsv";
    case full_media_type::L16: return "audio/L16";
    case full_media_type::L24: return "audio/L24";
    case full_media_type::SMPTE291: return "video/smpte291";
    case full_media_type::TTMLXML: return "ttml/ttml+xml";
    default: assert(full_media_type == full_media_type::UNKNOWN); return "unknown";
    }
}

media::full_media_type media::full_media_from_string(std::string_view media)
{
    if(media == "video/raw")
        return full_media_type::RAW;
    else if(media == "video/jxsv")
        return full_media_type::JXSV;
    else if(media == "audio/L16")
        return full_media_type::L16;
    else if(media == "audio/L24")
        return full_media_type::L24;
    else if(media == "video/smpte291")
        return full_media_type::SMPTE291;
    else if(media == "ttml/ttml+xml")
        return full_media_type::TTMLXML;
    else
        return full_media_type::UNKNOWN;
}
